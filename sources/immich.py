"""Immich: random photos for the wall frames, and whether the photographer has work (upload and machine learning jobs).

Needs secrets/immich_key (Account settings, API Keys; read permissions for assets, server statistics and jobs) and sources.immich.url.
SERVICE makes the photographer a worker at a desk: busy while any job is running or waiting.
"""
import json
import re
import time
import urllib.request

NAME = "immich"
SERVICE = "Immich"
EVERY = 10
FRAMES = 2
state = {"photos": [], "at": 0}
known = set()
cache = {}
ID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def base(ctx):
    return (ctx.config.get("url") or "http://localhost:2283").rstrip("/")


def call(ctx, path, body=None):
    headers = {"x-api-key": ctx.secret("immich_key"), "Content-Type": "application/json"}
    req = urllib.request.Request(base(ctx) + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def poll(ctx):
    stats = call(ctx, "/api/server/statistics")
    jobs = call(ctx, "/api/jobs")
    running = {name: (q.get("jobCounts") or {}) for name, q in jobs.items()}
    active = sum(c.get("active", 0) for c in running.values())
    waiting = sum(c.get("waiting", 0) for c in running.values())
    if time.time() - state["at"] > ctx.config.get("photo_every", 120):
        photos = call(ctx, "/api/search/random", {"size": FRAMES, "type": "IMAGE", "withExif": True})
        state["photos"] = [{"id": p["id"], "taken": p.get("localDateTime") or p.get("fileCreatedAt"), "place": ((p.get("exifInfo") or {}).get("city") or "")} for p in photos if ID.fullmatch(p["id"])]
        known.update(p["id"] for p in state["photos"])
        state["at"] = time.time()
    busy = active + waiting
    names = [n for n, c in running.items() if c.get("active", 0) or c.get("waiting", 0)]
    return {
        "ok": True, "photos": stats.get("photos", 0), "videos": stats.get("videos", 0), "usage": stats.get("usage", 0),
        "active": active, "waiting": waiting, "busy": bool(busy), "task": f"Working through {busy} job{'s' if busy != 1 else ''} ({', '.join(names[:3])})" if busy else None,
        "frames": [{**p, "image": "/media/immich/photo?id=" + p["id"]} for p in state["photos"]],
    }


def media(ctx, name, query):
    """A preview of one of the photos poll() chose for the frames (no other photo can be asked for)."""
    pid = (query.get("id") or [""])[0]
    if name != "photo" or pid not in known:
        return None
    if pid not in cache:
        req = urllib.request.Request(base(ctx) + f"/api/assets/{pid}/thumbnail?size=preview", headers={"x-api-key": ctx.secret("immich_key")})
        with urllib.request.urlopen(req, timeout=20) as r:
            cache[pid] = (r.read(4_000_000), r.headers.get("Content-Type", "image/jpeg"))
        while len(cache) > 8:
            cache.pop(next(iter(cache)))
    return cache[pid]
