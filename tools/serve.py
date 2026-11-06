#!/usr/bin/env python3
"""Geliştirme sunucusu (önbelleksiz): python3 tools/serve.py -> http://localhost:5173"""
import http.server, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('', 5173), H).serve_forever()
