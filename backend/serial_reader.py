import threading
import time
import csv
import os
from datetime import datetime
import serial
from serial.tools import list_ports


def find_serial_port(preferred=None):
    # If provided, try that first
    if preferred:
        try:
            s = serial.Serial(preferred)
            s.close()
            return preferred
        except Exception:
            pass

    # Allow override from environment variable
    env_pref = os.environ.get('SERIAL_PORT')
    if env_pref:
        try:
            s = serial.Serial(env_pref)
            s.close()
            return env_pref
        except Exception:
            pass

    # Look for ports mentioning teensy, arduino, ACM/USB, COM on Windows, or usb/tty
    ports = list_ports.comports()
    if not ports:
        print('No serial ports detected on the system')
        return None

    # Print available ports for debugging
    try:
        avail = [f"{p.device} ({p.description})" for p in ports]
        print('Available serial ports:', ', '.join(avail))
    except Exception:
        pass

    for p in ports:
        desc = (p.description or "").lower()
        dev = (p.device or "").lower()
        if ('teensy' in desc or 'arduino' in desc or 'cdc acm' in desc
                or 'usb' in desc or 'usb' in dev
                or dev.startswith('com')
                or dev.startswith('/dev/ttyacm')
                or dev.startswith('/dev/ttyusb')):
            return p.device

    # fallback to first available
    return ports[0].device


class SerialReader(threading.Thread):
    """Read lines from a serial device, parse CSV, call a callback for each parsed row, and log session to a file."""

    def __init__(self, port=None, baud=115200, socket_emit_cb=None, sessions_dir='sessions'):
        super().__init__(daemon=True)
        self.port = port
        self.baud = baud
        self.socket_emit_cb = socket_emit_cb
        self._stop = threading.Event()
        self.ser = None
        # Default header based on expected data format
        self.header = ["ts_ms", "device", "rpm", "voltage_mV", "current_mA", "consumption_mAh", "pwm_x10", "throttle_x10", "tempC_x10", "bec_voltage_mV", "bec_current_mA", "bec_tempC_x10", "status", "rx_bytes", "rx_frames_received", "rx_frames_dropped"]
        self.sessions_dir = sessions_dir
        os.makedirs(self.sessions_dir, exist_ok=True)
        self.session_file = None
        self.session_writer = None

    def open_session_file(self):
        now = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        fname = os.path.join(self.sessions_dir, f'telemetry_{now}.csv')
        f = open(fname, 'w', newline='')
        self.session_file = f
        self.session_writer = csv.writer(f)
        return fname

    def stop(self):
        self._stop.set()
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
        except Exception:
            pass
        try:
            if self.session_file:
                self.session_file.close()
        except Exception:
            pass

    def run(self):
        # open serial
        port = find_serial_port(self.port)
        if not port:
            print('No serial ports found')
            return
        print(f'Using serial port: {port}')

        try:
            self.ser = serial.Serial(port, self.baud, timeout=1)
        except Exception as e:
            print(f'Error opening serial: {e}')
            return

        session_path = self.open_session_file()
        print(f'Recording session to {session_path}')
        
        line_count = 0

        # simple loop reading lines
        try:
            while not self._stop.is_set():
                try:
                    if self.ser.in_waiting > 0:
                        raw = self.ser.readline()
                    else:
                        time.sleep(0.01)
                        continue
                except Exception as e:
                    # On some errors, we might want to break or just continue
                    time.sleep(0.1)
                    continue

                if not raw:
                    continue

                try:
                    line = raw.decode('utf-8', errors='replace').strip()
                except Exception:
                    line = raw.decode('latin-1', errors='replace').strip()

                if not line:
                    continue
                
                line_count += 1
                if line_count <= 5:
                    print(f"Serial Data Example: {line}")
                elif line_count == 6:
                    print("Data flowing...")

                # If the line contains "ts_ms", it's a header line
                if 'ts_ms' in line:
                    self.header = [c.strip() for c in line.split(',')]
                    try:
                        self.session_writer.writerow(self.header)
                        self.session_file.flush()
                    except Exception:
                        pass
                    continue

                # Parse data line
                parts = [p.strip() for p in line.split(',')]
                
                # Write to session file
                try:
                    self.session_writer.writerow(parts)
                    self.session_file.flush()
                except Exception:
                    pass

                # Emit to socket
                try:
                    if self.socket_emit_cb:
                        # Ensure we have enough parts; pad or trim if needed
                        if len(parts) < len(self.header):
                            parts += [''] * (len(self.header) - len(parts))
                        elif len(parts) > len(self.header):
                            parts = parts[:len(self.header)]
                        
                        row = dict(zip(self.header, parts))
                        self.socket_emit_cb(row)
                except Exception:
                    pass
        finally:
            # cleanup
            try:
                if self.ser and self.ser.is_open:
                    self.ser.close()
            except Exception:
                pass
            try:
                if self.session_file:
                    self.session_file.close()
            except Exception:
                pass

        
