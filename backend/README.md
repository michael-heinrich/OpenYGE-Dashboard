# ESC Telemetry Backend

This backend reads telemetry CSV lines from the Teensy USB serial port, records them to a timestamped session CSV file, and forwards parsed rows to connected clients via WebSocket (Socket.IO).

Requirements
- Python 3.8+
- Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Run

```bash
python app.py --port /dev/ttyACM0 --baud 115200 --sessions ./sessions
```

If `--port` is omitted the server will attempt to auto-detect the Teensy/USB serial port.

WebSocket
- Connect a Socket.IO client to `http://<host>:5000` and listen for the `telemetry` event. Each event contains a dict mapping CSV header names to string values.

Session files
- Session CSV files are written to the `sessions/` directory with a timestamped filename.

Notes
- This is a minimal backend intended for local use; add authentication and origin restrictions before exposing publicly.
