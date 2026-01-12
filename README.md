# ESC_webapp

ESC_webapp reads, stores and visualizes OpenYGE telemetry from YGE ESCs using a Teensy 4.0.

- Telemetry format: OpenYGE CSV-style output
- Hardware: Teensy 4.0 capturing up to two ESC telemetry channels

## Overview

This repository contains:
- [collector](collector) — Teensy firmware (PlatformIO) that captures ESC telemetry and prints CSV over USB serial
- [backend](backend) — Python backend that reads the USB serial, records sessions, and serves a web dashboard
- `static/`, `templates/` — frontend dashboard files to visualize telemetry

## Windows installation (quick)

This project provides one-click helper scripts (batch files) for Windows. The installer will attempt to install Python if it's missing.

1. From the repository root run the installer batch (one click):

```bat
install.bat
```

Notes:
- `install.bat` will try to install Python via `winget` if Python is not found. If `winget` is not available or the automatic install fails, install Python manually and then install the requirements below.
- The installer uses the repository's top-level `requirements.txt`.

Manual install (if you prefer):

```bat
python -m pip install -r requirements.txt
```

### Building/flashing the Teensy collector

To build (and optionally upload) the collector firmware on Windows run:

```bat
collector\\build_windows.bat
```

This script uses the PlatformIO CLI (`pio`) or `python -m platformio` to build the `teensy40` environment. If you prefer a GUI, open the `collector` folder in VS Code and use the PlatformIO extension to build/upload.

## Hardware wiring and behavior

- Connect ESC telemetry TX lines to the Teensy RX pins for the two serial channels.
  - ESC #1 TX -> Teensy RX1 (Serial1)
  - ESC #2 TX -> Teensy RX2 (Serial2)
- The collector firmware reads both UARTs, formats CSV lines and prints them over the Teensy's USB serial connection. The backend reads that USB serial, records sessions to `sessions/` and serves the dashboard.
- Ensure common ground between ESCs and the Teensy. Power ESCs/vehicle appropriately.

## Run the dashboard (Windows)

Start the dashboard server with the helper batch:

```bat
launch_dashboard.bat
```

Or run the backend directly from the repository root:

```bat
python backend\\app.py
```

Open a browser to the addresses printed by the server (typically http://localhost:5000).

Telemetry sessions are saved as CSV files in the `sessions/` directory.

## Troubleshooting

- No telemetry: verify ESCs are configured to output OpenYGE telemetry and TX lines are connected to the Teensy's RX pins.
- No serial port detected: check Windows Device Manager for the Teensy USB serial (COM) port, and confirm the collector firmware is running on the Teensy.
- PlatformIO build issues: ensure PlatformIO CLI or the VS Code PlatformIO extension is installed.

## Files of interest
- [collector](collector)
- [backend](backend)
- Dashboard UI: `static/` and `templates/`

## License
GPLv3, see [LICENSE](LICENSE) in the repository root.
