"""Seerr (Overseerr/Jellyseerr): request counts and the newest requests, for the suggestion box.

Needs secrets/seerr_key (Settings, General, API key) and sources.seerr.url. Seerr's request list is slow (it looks each title up), so it is
read every few minutes and the titles are remembered.
"""
import time

NAME = "seerr"
EVERY = 60
titles = {}
cache = {"at": 0, "latest": []}


def call(ctx, path, timeout=8):
    base = (ctx.config.get("url") or "http://localhost:5055").rstrip("/")
    return ctx.get_json(base + path, {"X-Api-Key": ctx.secret("seerr_key")}, timeout=timeout)


def title_of(ctx, kind, tmdb):
    key = (kind, tmdb)
    if key not in titles:
        try:
            info = call(ctx, f"/api/v1/{kind}/{tmdb}", timeout=20)
            titles[key] = info.get("title") or info.get("name") or f"{kind} {tmdb}"
        except OSError:
            return f"{kind} {tmdb}"
    return titles[key]


def poll(ctx):
    count = call(ctx, "/api/v1/request/count")
    if time.time() - cache["at"] > 300:
        results = call(ctx, "/api/v1/request?take=5&sort=added", timeout=30).get("results", [])
        cache["latest"] = [{"title": title_of(ctx, r["type"], r["media"]["tmdbId"]), "status": {1: "pending", 2: "approved", 3: "declined", 4: "available", 5: "available"}.get(r.get("status"), "?"), "when": r.get("createdAt")} for r in results]
        cache["at"] = time.time()
    return {"ok": True, "total": count["total"], "pending": count["pending"], "approved": count["approved"], "processing": count["processing"], "available": count.get("available", 0) + count.get("completed", 0), "latest": cache["latest"]}
