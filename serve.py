#!/usr/bin/env python3
"""Dev server with no-cache headers so browser always gets fresh JS."""
from http.server import HTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 8080), NoCacheHandler).serve_forever()
