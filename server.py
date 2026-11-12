#!/usr/bin/env python3
"""
Offline mode for the JPCI Family Feud game.

Run this on the HOST computer (needs Python 3, nothing else, no internet):
    python server.py        (Windows: double-click start-offline.bat)

Then:
  * Host computer opens  http://localhost:8000/host.html
  * Board computer opens http://<host-computer-address>:8000/board.html   (the address is printed below)
Both computers just need to be on the same network (same Wi-Fi/router, or a cable between them).
"""
import http.server, socketserver, json, os, socket, sys, threading, time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
cond = threading.Condition()
store = {"seq": 0, "state": None}
boards = {}            # client id -> last poll time


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))   # no traffic is sent; just picks the right network card
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        s.close()


IP = lan_ip()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _q(self):
        out = {}
        if "?" in self.path:
            for kv in self.path.split("?", 1)[1].split("&"):
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    out[k] = v
        return out

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/ping":
            now = time.time()
            n = len([1 for t in boards.values() if now - t < 25])
            return self._json({"ok": True, "ip": IP, "port": PORT, "boards": n})
        if path == "/api/state":
            q = self._q()
            try:
                seq = int(q.get("seq", "-1"))
            except ValueError:
                seq = -1
            cid = q.get("cid", "?")
            boards[cid] = time.time()
            with cond:
                if store["seq"] <= seq:
                    cond.wait(timeout=15)
                boards[cid] = time.time()
                return self._json({"seq": store["seq"], "state": store["state"] if store["seq"] > seq else None})
        if path in ("", "/"):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/state":
            return self._json({"ok": False}, 404)
        n = int(self.headers.get("Content-Length", "0"))
        try:
            st = json.loads(self.rfile.read(n) or b"null")
        except Exception:
            return self._json({"ok": False}, 400)
        with cond:
            cur = store["state"]
            # ignore a state that arrives late (older version of the same session)
            if not (cur and isinstance(st, dict) and cur.get("sid") == st.get("sid") and st.get("v", 0) < cur.get("v", 0)):
                store["state"] = st
                store["seq"] += 1
                cond.notify_all()
        self._json({"ok": True})


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    print("=" * 62)
    print("  JPCI Family Feud – offline server running")
    print("=" * 62)
    print("  Host computer (this one):   http://localhost:%d/host.html" % PORT)
    print("  Board / projector computer: http://%s:%d/board.html" % (IP, PORT))
    print()
    print("  Keep this window open during the game. Press Ctrl+C to stop.")
    print("=" * 62)
    try:
        Server(("0.0.0.0", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
