# OpenYGE-Dashboard

OpenYGE-Dashboard reads, stores and visualizes OpenYGE telemetry from YGE ESCs using a Teensy 4.0.

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

There are dedicated top-level helper scripts for Windows (run from the repository root):

- `build_teensy.bat` — build the `collector` firmware (PlatformIO) without uploading
- `build_flash_teensy.bat` — build and upload (flash) the firmware to a connected Teensy (interactive confirmation)

Run the build only:

```bat
build_teensy.bat
```

Run build-and-flash:

```bat
build_flash_teensy.bat
```

Both scripts invoke PlatformIO for the `teensy40` environment and operate on the `collector` project directory. The script `collector\\build_windows.bat` also exists and can be used directly from the `collector` folder, but the top-level scripts are provided as the one-click helpers.

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
