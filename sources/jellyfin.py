"""Jellyfin: who is watching what right now, for the TV above the couch.

Needs secrets/jellyfin_key (an API key from Jellyfin's dashboard, API Keys) and sources.jellyfin.url in config.json.
"""
NAME = "jellyfin"
EVERY = 5


def call(ctx, path):
    base = (ctx.config.get("url") or "http://localhost:8096").rstrip("/")
    return ctx.get_json(base + path, {"Authorization": f'MediaBrowser Token="{ctx.secret("jellyfin_key")}"'}, timeout=8)


def poll(ctx):
    users = [u["Name"] for u in call(ctx, "/Users") if not (u.get("Policy") or {}).get("IsDisabled")]
    streams = []
    for s in call(ctx, "/Sessions"):
        item = s.get("NowPlayingItem")
        if not item:
            continue
        total = item.get("RunTimeTicks") or 0
        play = s.get("PlayState") or {}
        title = f"{item['SeriesName']} S{item.get('ParentIndexNumber', 0):02d}E{item.get('IndexNumber', 0):02d}" if item.get("SeriesName") else item.get("Name", "?")
        streams.append({
            "who": s.get("UserName"), "title": title, "device": s.get("DeviceName"), "paused": bool(play.get("IsPaused")),
            "pct": round((play.get("PositionTicks") or 0) / total * 100) if total else 0,
        })
    return {"ok": True, "users": users, "streams": streams}
