"""Headphones (the music downloader): the albums that arrived lately, for the record crate.

Reads Headphones' own database read-only (no API key): `albums` has a status per album (Wanted, Snatched = on its way, Downloaded).
Covers come from the small pictures Headphones keeps in its cache folder. Config:
  "sources": {"headphones": {"db": "/path/to/headphones/config/headphones.db", "open": "http://host:8181"}}
The cover folder is `<folder of db>/cache/artwork` unless `artwork` says otherwise.
"""
import os
import re
import sqlite3

NAME = "headphones"
EVERY = 30
CRATE = 8
ids = set()  # album ids poll() has seen, so /media can only serve covers of real albums


def artwork_dir(ctx):
    return ctx.config.get("artwork") or os.path.join(os.path.dirname(ctx.config.get("db") or "."), "cache", "artwork")


def poll(ctx):
    db = ctx.config.get("db")
    if not db:
        raise RuntimeError("sources.headphones.db is not set")
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
    try:
        counts = dict(conn.execute("select Status, count(*) from albums where Status in ('Wanted', 'Downloaded') group by Status").fetchall())
        # a Snatched album is on its way, unless it has been stuck for days: only recent ones count as arriving
        recent = "Status = 'Snatched' and DateAdded >= date('now', '-3 days')"
        counts["Snatched"] = conn.execute(f"select count(*) from albums where {recent}").fetchone()[0]
        rows = conn.execute(f"select AlbumID, AlbumTitle, ArtistName, Status, DateAdded from albums where Status = 'Downloaded' or ({recent}) order by DateAdded desc limit ?", (CRATE,)).fetchall()
        wanted = conn.execute("select AlbumTitle, ArtistName from albums where Status = 'Wanted' order by DateAdded desc limit 6").fetchall()
    finally:
        conn.close()
    ids.update(r[0] for r in rows)
    return {
        "ok": True,
        "arriving": counts.get("Snatched", 0), "downloaded": counts.get("Downloaded", 0), "wanted": counts.get("Wanted", 0),
        "crate": [{"id": r[0], "title": r[1], "artist": r[2], "status": r[3].lower(), "added": r[4], "cover": "/media/headphones/cover?id=" + r[0]} for r in rows],
        "wanted_list": [{"title": t, "artist": a} for t, a in wanted],
    }


def media(ctx, name, query):
    """The small cover Headphones cached for an album poll() has seen."""
    album = (query.get("id") or [""])[0]
    if name != "cover" or album not in ids or not re.fullmatch(r"[0-9a-f-]{8,40}", album):
        return None
    folder = artwork_dir(ctx)
    for entry in sorted(os.listdir(folder), reverse=True):
        if entry.startswith("T_" + album) and entry.lower().endswith((".jpg", ".jpeg", ".png")):
            with open(os.path.join(folder, entry), "rb") as f:
                return f.read(), "image/png" if entry.lower().endswith(".png") else "image/jpeg"
    return None
