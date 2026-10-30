"""Static server for the app with gzip (the data files are ~21 MB as GeoJSON, ~2 MB gzipped).
Usage:  python3 scripts/serve.py [--port 5500] [--bind 0.0.0.0] [--directory .]
Text files (html, js, css, json, geojson, svg) are gzipped once per file version and kept in memory;
ETag + If-None-Match let the browser reuse its copy when nothing changed.
"""
import argparse, functools, gzip, http.server, os

GZ_TYPES = {".html", ".js", ".css", ".json", ".geojson", ".svg", ".txt", ".csv"}
_cache = {}  # path -> (mtime_ns, size, gzipped bytes)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".geojson": "application/geo+json", ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # always revalidate, reuse when the ETag matches
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        ext = os.path.splitext(path)[1].lower()
        if ext not in GZ_TYPES or "gzip" not in self.headers.get("Accept-Encoding", "") or not os.path.isfile(path):
            return super().send_head()
        st = os.stat(path)
        etag = f'"{st.st_mtime_ns:x}-{st.st_size:x}-gz"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.end_headers()
            return None
        hit = _cache.get(path)
        if not hit or hit[:2] != (st.st_mtime_ns, st.st_size):
            with open(path, "rb") as f:
                hit = _cache[path] = (st.st_mtime_ns, st.st_size, gzip.compress(f.read(), 6))
        body = hit[2]
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("ETag", etag)
        self.send_header("Vary", "Accept-Encoding")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)
        return None


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=5500)
    p.add_argument("--bind", default="0.0.0.0")
    p.add_argument("--directory", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    a = p.parse_args()
    handler = functools.partial(Handler, directory=os.path.abspath(a.directory))
    print(f"Serving {os.path.abspath(a.directory)} on http://{a.bind}:{a.port} (gzip on)")
    http.server.ThreadingHTTPServer((a.bind, a.port), handler).serve_forever()
