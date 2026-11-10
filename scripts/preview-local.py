#!/usr/bin/env python3
"""Isolated, loopback-only CMS preview. Never calls Netlify or any remote API."""
import argparse
import copy
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.local-preview' / 'content.json'


def initial_data():
    base = json.loads((ROOT / 'seed/content.json').read_text())
    drafts = json.loads((ROOT / 'fixtures/after-sales-policies.json').read_text())
    items = base['items'] + drafts['items']
    for item in items:
        if str(item.get('imageUrl', '')).startswith('seed:'):
            item['imageUrl'] = '/preview-images/' + item['imageUrl'][5:]
    return {'items': items, 'updatedAt': datetime.now(timezone.utc).isoformat()}


def write_data(data):
    DATA.parent.mkdir(exist_ok=True)
    temp = DATA.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    os.replace(temp, DATA)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'public'), **kwargs)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/data':
            data = json.loads(DATA.read_text())
            return self.send_json({**data, 'localPreview': True})
        if path in ('/admin', '/admin/'):
            body = (ROOT / 'public/admin/index.html').read_text().replace(
                'Nhập mật khẩu để truy cập trang quản trị.',
                'Bản thử trên máy. Nhập mật khẩu thử: local. Không dùng tài khoản thật.')
            encoded = body.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            return self.wfile.write(encoded)
        if path.startswith('/preview-images/'):
            name = Path(unquote(path)).name
            image = ROOT / 'seed/images' / name
            if not image.is_file():
                return self.send_error(404)
            self.send_response(200)
            self.send_header('Content-Type', 'image/png' if image.suffix == '.png' else 'image/jpeg')
            self.end_headers()
            return self.wfile.write(image.read_bytes())
        if path.startswith('/api/'):
            return self.send_json({'ok': False, 'error': 'API không có trong bản thử.'}, 404)
        super().do_GET()

    def do_POST(self):
        origin = self.headers.get('Origin')
        if origin and urlparse(origin).netloc != self.headers.get('Host'):
            return self.send_json({'ok': False}, 403)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if size > 5_000_000:
                return self.send_json({'ok': False}, 413)
            body = json.loads(self.rfile.read(size))
        except (ValueError, TypeError):
            return self.send_json({'ok': False, 'error': 'Invalid JSON'}, 400)
        path = urlparse(self.path).path
        if path == '/api/login':
            valid = body.get('password') == 'local'
            return self.send_json({'ok': valid}, 200 if valid else 401)
        if path == '/api/save':
            if self.headers.get('x-cms-password') != 'local':
                return self.send_json({'ok': False}, 401)
            if not isinstance(body.get('items'), list):
                return self.send_json({'ok': False}, 400)
            data = {'items': body['items'], 'updatedAt': datetime.now(timezone.utc).isoformat()}
            write_data(data)
            return self.send_json({'ok': True, 'count': len(data['items']), 'updatedAt': data['updatedAt']})
        self.send_json({'ok': False, 'error': 'Chức năng này không bật trong bản thử.'}, 404)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--reset', action='store_true', help='Restore local sample data only')
    args = parser.parse_args()
    if args.reset or not DATA.exists():
        write_data(initial_data())
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Local: http://127.0.0.1:{args.port}/?brand=TUTIMI&type=policy&drafts=1', flush=True)
    print(f'CMS:   http://127.0.0.1:{args.port}/admin/  (mật khẩu thử: local)', flush=True)
    print('Dữ liệu độc lập trong .local-preview/content.json. Không kết nối Netlify.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
