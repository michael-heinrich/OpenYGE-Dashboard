**Python backend with Flask for ESC Webapp**




We get ESC telemetry data from the Teensy 4.0 running the PIO ESC Telemetry tool (see ../pio_esc_tel) over USB serial and serve it via a webapp using Flask.
The output looks like this:

```
[pin0 after USB] MUX=ALT5(GPIO)  DIR=IN LEVEL=LOW  CFG=0x5 PAD=0x10B0 DDR=0x0 PIN=0x0 PAD(bin)=0000_0000_0000_0000_0001_0000_1011_0000 bitmask=0x8
[pin0 after Serial1.begin] MUX=ALT2  DIR=IN LEVEL=LOW  CFG=0x2 PAD=0x1F038 DDR=0x0 PIN=0x0 PAD(bin)=0000_0000_0000_0001_1111_0000_0011_1000 bitmask=0x8
[pio_esc_tel] boot
ts_ms,device,rpm,voltage_mV,current_mA,consumption_mAh,pwm_x10,throttle_x10,tempC_x10,bec_voltage_mV,bec_current_mA,bec_tempC_x10,status,rx_bytes,rx_frames_received,rx_frames_dropped
[pin0 after USB] MUX=ALT5(GPIO)  DIR=IN LEVEL=LOW  CFG=0x5 PAD=0x10B0 DDR=0x0 PIN=0x2004 PAD(bin)=0000_0000_0000_0000_0001_0000_1011_0000 bitmask=0x8
[pin0 after Serial1.begin] MUX=ALT2  DIR=IN LEVEL=LOW  CFG=0x2 PAD=0x1F038 DDR=0x0 PIN=0x2000 PAD(bin)=0000_0000_0000_0001_1111_0000_0011_1000 bitmask=0x8
[pio_esc_tel] boot
ts_ms,device,rpm,voltage_mV,current_mA,consumption_mAh,pwm_x10,throttle_x10,tempC_x10,bec_voltage_mV,bec_current_mA,bec_tempC_x10,status,rx_bytes,rx_frames_received,rx_frames_dropped
895,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,13,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
895,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
```



```
127704,1,0,22990,0,0,0,0,230,6009,0,240,0,62084,1826,0
```

Decoded columns:
- ts_ms: Timestamp in milliseconds (127704 ms since boot)
- device: ESC device ID (1)
- rpm: Motor RPM (0)
- voltage_mV: ESC voltage in millivolts (22990 mV = 22.99 V)
- current_mA: ESC current in milliamps (0 mA)
- consumption_mAh: Consumed capacity in milliamp-hours (0 mAh)
- pwm_x10: PWM value multiplied by 10 (0)
- throttle_x10: Throttle value multiplied by 10 (0)
- tempC_x10: ESC temperature in tenths of degrees Celsius (230 = 23.0 °C)
- bec_voltage_mV: BEC voltage in millivolts (6009 mV = 6.009 V)
- bec_current_mA: BEC current in milliamps (0 mA)
- bec_tempC_x10: BEC temperature in tenths of degrees Celsius (240 = 24.0 °C)
- status: ESC status (0)
- rx_bytes: Received bytes (62084)
- rx_frames_received: Received frames (1826)
- rx_frames_dropped: Dropped frames (0)