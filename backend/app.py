from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit
import argparse
import socket
import signal
import sys
import webbrowser
import atexit
import os
from serial_reader import SerialReader

app = Flask(__name__, static_folder='static', template_folder='templates')
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading')

reader = None


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('connect')
def on_connect():
    print('Client connected')


@socketio.on('disconnect')
def on_disconnect():
    print('Client disconnected')


def emit_row(row: dict):
    # emit the parsed row to all connected clients
    socketio.emit('telemetry', row)


def start_serial(port=None, baud=115200, sessions_dir='sessions'):
    global reader
    if reader is not None:
        return
    reader = SerialReader(port=port, baud=baud, socket_emit_cb=emit_row, sessions_dir=sessions_dir)
    reader.start()


def stop_serial():
    global reader
    if reader:
        reader.stop()
        reader = None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', help='serial port device (e.g. /dev/ttyACM0)', default=None)
    parser.add_argument('--baud', help='baud rate', type=int, default=115200)
    parser.add_argument('--sessions', help='sessions directory', default='sessions')
    parser.add_argument('--host', help='flask host', default='0.0.0.0')
    parser.add_argument('--http-port', help='flask http port', type=int, default=5000)
    args = parser.parse_args()

    # Pre-calculate URLs
    def _get_local_ip():
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return '127.0.0.1'

    urls = [f'http://localhost:{args.http_port}/']
    local_ip = _get_local_ip()
    if local_ip and local_ip != '127.0.0.1':
        urls.append(f'http://{local_ip}:{args.http_port}/')

    print('\n--- ESC Webapp Server ---', flush=True)
    print('Listening on:', flush=True)
    for u in urls:
        print(f'  {u}', flush=True)
    print('-------------------------\n', flush=True)

    # Start serial
    start_serial(port=args.port, baud=args.baud, sessions_dir=args.sessions)
    atexit.register(stop_serial)

    # Disable the reloader so a KeyboardInterrupt (Ctrl+C) stops the process
    try:
        socketio.run(app, host=args.host, port=args.http_port, use_reloader=False, debug=False)
    except KeyboardInterrupt:
        print('\nShutting down...')
    finally:
        stop_serial()


if __name__ == '__main__':
    main()
