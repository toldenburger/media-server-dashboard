"""Cloudflared tunnel: connections up and requests handled, for the fax machine in the server space.

Reads the tunnel's own metrics page (cloudflared runs with --metrics, default 127.0.0.1:20241).
"""
import re
import urllib.request

NAME = "cloudflared"
EVERY = 10
last = {"requests": None}


def poll(ctx):
    base = (ctx.config.get("url") or "http://127.0.0.1:20241").rstrip("/")
    with urllib.request.urlopen(base + "/metrics", timeout=5) as r:
        text = r.read().decode("utf-8", "replace")
    try:
        with urllib.request.urlopen(base + "/ready", timeout=5) as r:
            ready = r.status == 200
    except OSError:
        ready = False
    num = lambda name: sum(float(v) for v in re.findall(rf"^{name}(?:{{[^}}]*}})? ([\d.e+]+)$", text, re.M))
    requests = int(num("cloudflared_tunnel_response_by_code"))
    fresh = max(0, requests - last["requests"]) if last["requests"] is not None else 0
    last["requests"] = requests
    errors = int(num("cloudflared_tunnel_request_errors"))
    return {"ok": ready, "connections": int(num("cloudflared_tunnel_ha_connections")), "requests": requests, "errors": errors, "fresh_requests": min(fresh, 200)}
