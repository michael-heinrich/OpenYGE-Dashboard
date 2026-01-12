// OpenYGE ESC telemetry collector for Teensy 4.x
// Protocol implementation based on rotorflight-firmware
// See https://github.com/rotorflight/rotorflight-firmware/blob/master/src/main/sensors/esc_sensor.c


#include <Arduino.h>
#include <TeensyThreads.h>
// for CORE_PINx register macros
#include "core_pins.h"

// OpenYGE constants
#define OPENYGE_SYNC 0xA5
#define OPENYGE_FTYPE_TELE_AUTO 0x00
#define OPENYGE_FTYPE_TELE_RESP 0x02
#define OPENYGE_HEADER_LENGTH 6
#define OPENYGE_HEADER_LENGTH_LEGACY 4
#define OPENYGE_CRC_LENGTH 2

// maximum devices tracked (support addresses 0..127)
#define MAX_DEVICES 128

// buffer
static const size_t MAX_FRAME = 128;

// telemetry storage
struct TelemetryData {
  volatile uint32_t lastSeenMs;
  volatile uint32_t rpm;       // rpm
  volatile int32_t voltage_mV; // mV
  volatile int32_t current_mA; // mA
  volatile uint32_t consumption_mAh;
  volatile int16_t pwm;       // % *10
  volatile int16_t throttle;  // % *10
  volatile int16_t tempC_x10;
  volatile int16_t bec_tempC_x10;
  volatile int32_t bec_voltage_mV;
  volatile int32_t bec_current_mA;
  volatile uint8_t status;
  volatile uint32_t rx_bytes_received;
  volatile uint32_t rx_frames_received;
  volatile uint32_t rx_frames_dropped;
} telemetry[MAX_DEVICES];

// CRC16-CCITT implementation (same polynomial used in rotorflight)
static uint16_t oygeCalculateCRC16_CCITT(const uint8_t *ptr, size_t len)
{
  uint16_t crc = 0;
  for (size_t j = 0; j < len; j++) {
    crc = (uint16_t)(crc ^ (uint16_t)ptr[j] << 8);
    for (uint8_t i = 0; i < 8; i++) {
      if (crc & 0x8000)
        crc = (uint16_t)(crc << 1 ^ 0x1021);
      else
        crc = (uint16_t)(crc << 1);
    }
  }
  return crc;
}

// helper to parse a frame buffer and store telemetry
static void parseOpenYGEFrame(const uint8_t *buf, size_t len)
{
  if (len < (OPENYGE_HEADER_LENGTH_LEGACY + OPENYGE_CRC_LENGTH)) return;
  if (buf[0] != OPENYGE_SYNC) return;

  uint8_t version = buf[1];
  uint8_t frame_type = buf[2];
  uint8_t frame_length = buf[3];
  // header length depends on version
  const uint8_t hdrlen = (version >= 3) ? OPENYGE_HEADER_LENGTH : OPENYGE_HEADER_LENGTH_LEGACY;
  if (frame_length != len) return;
  if (len < hdrlen + OPENYGE_CRC_LENGTH) return;

  // extract device field early so we can attribute drops to a device where possible
  uint8_t device = (version >= 3 && len > 5) ? buf[5] : 0;
  if (device >= MAX_DEVICES) device = 0;

  uint16_t crc_in = (uint16_t)buf[len - 2] | ((uint16_t)buf[len - 1] << 8);
  if (oygeCalculateCRC16_CCITT(buf, len - OPENYGE_CRC_LENGTH) != crc_in) {
    // attribute drop to device if sensible
    noInterrupts();
    telemetry[device].rx_frames_dropped++;
    interrupts();
    return;
  }

  if (frame_type != OPENYGE_FTYPE_TELE_AUTO && frame_type != OPENYGE_FTYPE_TELE_RESP) {
    noInterrupts();
    telemetry[device].rx_frames_dropped++;
    interrupts();
    return;
  }

  const uint8_t *payload = buf + hdrlen;
  size_t payload_len = len - hdrlen - OPENYGE_CRC_LENGTH;

  // rotorflight defines OpenYGETelemetryFrame_t layout; ensure payload length is large enough
  if (payload_len < 22) {
    noInterrupts();
    telemetry[device].rx_frames_dropped++;
    interrupts();
    return; // minimal fields present
  }

  // parse fields (little endian where appropriate)
  uint8_t temperature = payload[1];
  uint16_t voltage = payload[2] | ((uint16_t)payload[3] << 8);      // 0.01V
  uint16_t current = payload[4] | ((uint16_t)payload[5] << 8);      // 0.01A
  uint16_t consumption = payload[6] | ((uint16_t)payload[7] << 8);  // mAh
  uint16_t rpm = payload[8] | ((uint16_t)payload[9] << 8);          // 0.1erpm
  int8_t pwm = (int8_t)payload[10];                                 // %
  int8_t throttle = (int8_t)payload[11];                            // %
  uint16_t bec_voltage = payload[12] | ((uint16_t)payload[13] << 8); // 0.001V
  uint16_t bec_current = payload[14] | ((uint16_t)payload[15] << 8); // 0.001A
  uint8_t bec_temp = payload[16];
  uint8_t status1 = payload[17];

  // store atomically using interrupts disable while copy
  noInterrupts();
  telemetry[device].lastSeenMs = millis();
  telemetry[device].rpm = (uint32_t)rpm * 10; // as rotorflight stores erpm
  telemetry[device].voltage_mV = (int32_t)voltage * 10; // 0.01V -> mV
  telemetry[device].current_mA = (int32_t)current * 10; // 0.01A -> mA
  telemetry[device].consumption_mAh = (uint32_t)consumption;
  telemetry[device].pwm = (int16_t)pwm * 10;
  telemetry[device].throttle = (int16_t)throttle * 10;
  telemetry[device].tempC_x10 = ((int16_t)temperature - 40) * 10; // offset 40
  telemetry[device].bec_tempC_x10 = ((int16_t)bec_temp - 40) * 10;
  telemetry[device].bec_voltage_mV = (int32_t)bec_voltage; // in mV per rotorflight note
  telemetry[device].bec_current_mA = (int32_t)bec_current;
  telemetry[device].status = status1;
  telemetry[device].rx_frames_received++;
  telemetry[device].rx_bytes_received += (uint32_t)len;
  interrupts();
}

// reader state machine for a serial port
static void readerTask(void *arg)
{
  HardwareSerial *port = (HardwareSerial*)arg;
  uint8_t buf[MAX_FRAME];
  size_t pos = 0;
  size_t expected = 0;

  while (true) {
    while (port->available()) {
      uint8_t c = (uint8_t)port->read();
      // state: waiting for sync
      if (pos == 0) {
        if (c == OPENYGE_SYNC) {
          buf[pos++] = c;
        }
        continue;
      }

      // collecting header bytes until we know length
      buf[pos++] = c;
      if (pos == 4) {
        // frame_length is at buf[3]
        expected = buf[3];
        if (expected < (OPENYGE_HEADER_LENGTH_LEGACY + OPENYGE_CRC_LENGTH) || expected > MAX_FRAME) {
          // invalid length -> reset
          pos = 0; expected = 0; continue;
        }
      }

      if (expected && pos >= expected) {
        // full frame collected
        parseOpenYGEFrame(buf, expected);
        // reset
        pos = 0; expected = 0;
      }
    }
    Threads::yield();
  }
}

// printing thread: dump CSV regularly
static void printerTask(void *arg)
{
  (void)arg;
  // USB Serial is initialized in setup(); just print header once
  Serial.println("ts_ms,device,rpm,voltage_mV,current_mA,consumption_mAh,pwm_x10,throttle_x10,tempC_x10,bec_voltage_mV,bec_current_mA,bec_tempC_x10,status,rx_bytes,rx_frames_received,rx_frames_dropped");

  while (true) {
    uint32_t ts = millis();
    bool anyPrinted = false;
    for (int dev = 0; dev < MAX_DEVICES; dev++) {
      uint32_t seen;
      // copy values atomically
      noInterrupts();
      seen = telemetry[dev].lastSeenMs;
      TelemetryData copy = telemetry[dev];
      interrupts();

      // print if recent (within 60s) OR there is any RX activity (received bytes/frames or drops)
      bool recent = (seen != 0 && ts - seen <= 60000);
      bool hasRxActivity = (copy.rx_bytes_received != 0 || copy.rx_frames_received != 0 || copy.rx_frames_dropped != 0);
      if (!recent && !hasRxActivity) continue;

      Serial.print(ts); Serial.print(',');
      Serial.print(dev); Serial.print(',');
      Serial.print(copy.rpm); Serial.print(',');
      Serial.print(copy.voltage_mV); Serial.print(',');
      Serial.print(copy.current_mA); Serial.print(',');
      Serial.print(copy.consumption_mAh); Serial.print(',');
      Serial.print(copy.pwm); Serial.print(',');
      Serial.print(copy.throttle); Serial.print(',');
      Serial.print(copy.tempC_x10); Serial.print(',');
      Serial.print(copy.bec_voltage_mV); Serial.print(',');
      Serial.print(copy.bec_current_mA); Serial.print(',');
      Serial.print(copy.bec_tempC_x10); Serial.print(',');
      Serial.print(copy.status); Serial.print(',');
      Serial.print(copy.rx_bytes_received); Serial.print(',');
      Serial.print(copy.rx_frames_received); Serial.print(',');
      Serial.println(copy.rx_frames_dropped);
      anyPrinted = true;
    }
    if (!anyPrinted) {
      // emit a heartbeat row: device -1 and zeros for telemetry columns
      Serial.print(ts); Serial.print(',');
      Serial.print(-1); Serial.print(',');
      // print remaining 14 zero columns to match header (rpm .. rx_frames_dropped)
      for (int i = 0; i < 14; ++i) {
        Serial.print(0);
        if (i < 13) Serial.print(',');
      }
      Serial.println();
    }
    threads.delay(500);
  }
}

// LED feedback thread
// Behavior:
// - No recent data: short LED flash once per second (50ms on, 950ms off)
// - Any ESC data and zero RPM: slow flashes 0.5Hz balanced on/off (1000ms on, 1000ms off)
// - Any ESC data and running: fast flashes 2Hz balanced on/off (250ms on, 250ms off)
static void ledTask(void *arg)
{
  (void)arg;
  const uint32_t recentMs = 2000; // consider data recent within 2s
  const uint32_t rpmRunningThreshold = 100; // RPM > 100 considered running
  pinMode(LED_BUILTIN, OUTPUT);

  while (true) {
    uint32_t now = millis();
    bool anyRecent = false;
    bool anyRunning = false;
    bool anyConnectedZeroRpm = false;

    for (int dev = 0; dev < MAX_DEVICES; dev++) {
      uint32_t seen;
      uint32_t rpm;
      noInterrupts();
      seen = telemetry[dev].lastSeenMs;
      rpm = telemetry[dev].rpm;
      interrupts();

      if (seen != 0 && now - seen <= recentMs) {
        anyRecent = true;
        if (rpm > rpmRunningThreshold) anyRunning = true;
        else anyConnectedZeroRpm = true;
      }
    }

    if (!anyRecent) {
      // nothing connected: one short flash per second (50ms on, 950ms off)
      digitalWrite(LED_BUILTIN, HIGH);
      threads.delay(50);
      digitalWrite(LED_BUILTIN, LOW);
      threads.delay(950);
    }
    else if (anyRunning) {
      // at least one ESC running: 2Hz 50:50 duty (250ms on, 250ms off)
      digitalWrite(LED_BUILTIN, HIGH);
      threads.delay(250);
      digitalWrite(LED_BUILTIN, LOW);
      threads.delay(250);
    }
    else if (anyConnectedZeroRpm) {
      // ESC(s) connected but all zero RPM: 0.5Hz 50:50 duty (1000ms on, 1000ms off)
      digitalWrite(LED_BUILTIN, HIGH);
      threads.delay(1000);
      digitalWrite(LED_BUILTIN, LOW);
      threads.delay(1000);
    }
    else {
      // fallback: short sleep
      threads.delay(100);
    }
  }
}

void setup()
{
  // initialize serial ports used for telemetry
  // initialize USB serial early so printer thread can use it
  Serial.begin(115200);
  delay(100);

  // Diagnostic: print CORE_PIN0 (RX1) register state once USB is up
  auto print_pin0_diag = [](const char *when) {
    uint32_t cfg = CORE_PIN0_CONFIG;
    uint32_t pad = CORE_PIN0_PADCONFIG;
    uint32_t ddr = CORE_PIN0_DDRREG;
    uint32_t pin = CORE_PIN0_PINREG;
    uint32_t bit = CORE_PIN0_BITMASK;
    bool level = (pin & bit) != 0;
    bool isOutput = (ddr & bit) != 0;
    uint32_t mux = cfg & 0x7;
    uint32_t sion = (cfg >> 4) & 0x1;

    // human-friendly header
    Serial.print("[pin0 "); Serial.print(when); Serial.print("] ");

    // MUX / function info
    Serial.print("MUX=ALT"); Serial.print(mux);
    if (mux == 5) Serial.print("(GPIO)");
    Serial.print(sion ? " SION" : "");
    Serial.print("  ");

    // direction / level
    Serial.print("DIR="); Serial.print(isOutput ? "OUT" : "IN");
    Serial.print(" ");
    Serial.print("LEVEL="); Serial.print(level ? "HIGH" : "LOW");
    Serial.print("  ");

    // raw register values (hex) and small pad binary for quick inspection
    Serial.print("CFG=0x"); Serial.print(cfg, HEX); Serial.print(' ');
    Serial.print("PAD=0x"); Serial.print(pad, HEX); Serial.print(' ');
    Serial.print("DDR=0x"); Serial.print(ddr, HEX); Serial.print(' ');
    Serial.print("PIN=0x"); Serial.print(pin, HEX); Serial.print(' ');

    // show pad register as binary grouped in nibble for visual parsing
    Serial.print("PAD(bin)=");
    for (int i = 31; i >= 0; --i) {
      Serial.print((pad >> i) & 1);
      if ((i % 4) == 0 && i != 0) Serial.print('_');
    }
    Serial.print(' ');

    Serial.print("bitmask=0x"); Serial.println(bit, HEX);
  };

  // initialize serial ports used for telemetry
  // print pin registers before and after enabling Serial1 so user can see changes
  print_pin0_diag("after USB");
  Serial1.begin(115200);
  print_pin0_diag("after Serial1.begin");
  Serial2.begin(115200);

  // ensure LED is off initially
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // start threads
  threads.addThread(readerTask, (void*) &Serial1);
  threads.addThread(readerTask, (void*) &Serial2);
  threads.addThread(printerTask, nullptr);
  threads.addThread(ledTask, nullptr);
  // ensure thread scheduler is running
  threads.start();

  // quick boot indicators
  Serial.println("[pio_esc_tel] boot");
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }
}

void loop()
{
  // main loop idle: keep alive and allow threads to run
  threads.delay(1000);
}
