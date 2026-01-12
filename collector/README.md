# PIO ESC Telemetry tool (Teensy 4.0)

Simple tool to capture OpenYGE auto-mode telemetry from two serial channels on a Teensy 4.0 and print CSV over USB serial.

Usage
- Connect ESC telemetry TX lines to `RX1` (Serial1) and `RX2` (Serial2) on the Teensy 4.0.
- Plug Teensy into USB; open host serial at `115200`.
- Build & upload with PlatformIO: `pio run -e teensy40 -t upload`.

Notes
- This project uses `TeensyThreads` (https://github.com/ftrias/TeensyThreads.git) to run reader threads for each UART and a printer thread that outputs CSV to the USB serial.
**PIO ESC Telemetry tool**

This tool runs on a Teensy 4.0 and allows to capture two channels of ESC telemetry data.

It supports OpenYGE and is based on esc_sensor.c from rotorflight-firware.