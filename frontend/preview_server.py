"""Serve frontend/dist at the /health-dashboard/ subpath.

The production build sets Vite's base to /health-dashboard/ (that is the GitHub
Pages path), so every asset URL in the bundle is /health-dashboard/assets/... and
every API call goes to /health-dashboard/api/.... A plain static server rooted at
dist/ cannot answer those, which is exactly why the site renders blank.

This server maps the subpath onto dist/ so the bundle behaves locally the way it
does in production: /health-dashboard/ -> dist/index.html,
/health-dashboard/api/... -> dist/api/....

Usage: python preview_server.py [port] [dist_dir]
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4180
DIST = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parent / "dist"
PREFIX = "/health-dashboard"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Drop any query string or fragment.
        path = path.split('?', 1)[0].split('#', 1)[0]
        if path.startswith(PREFIX):
            path = path[len(PREFIX):]
        # Normalise separators and prevent escaping dist/.
        path = path.replace('\\', '/').lstrip('/')
        if not path:
            path = 'index.html'
        dist_root = DIST.resolve()
        full = (dist_root / path).resolve()
        if dist_root not in full.parents:
            return str(dist_root / 'index.html')
        return str(full)

    def end_headers(self):
        # Static assets are fingerprinted and safe to cache; index.html is not.
        if self.path.startswith(PREFIX + "/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[preview] %s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    print(f"Serving {DIST} at http://localhost:{PORT}{PREFIX}/")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
