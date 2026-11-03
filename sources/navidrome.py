"""Navidrome: what was played lately, for the record player.

Reads Navidrome's own database read-only (no login or API key needed): the `scrobbles` table is its play history. Navidrome keeps
"now playing" only in memory, so a track counts as playing while its length has not yet passed since it was logged.

Needs in config.json:  "sources": {"navidrome": {"db": "/path/to/navidrome.db", "music_root": "/path/where/the/music/library/is"}}
`db` is the file Navidrome keeps in its data folder; `music_root` is the host folder that Navidrome's music library path points to
(album covers are found next to the music files, or inside them). Without `db` the record player simply stays empty.
"""
import os
import re
import sqlite3
import subprocess
import time
import urllib.parse

NAME = "navidrome"
EVERY = 15
STACK = 6
covers = {}  # album id -> (bytes, content type), or None when the album has no picture
paths = {}  # album id -> one music file's path inside the library, so covers can be found without trusting the browser
COVER_NAMES = re.compile(r"(cover|folder|front|album)\.(jpe?g|png)$", re.I)


def poll(ctx):
    db = ctx.config.get("db")
    if not db:
        raise RuntimeError("sources.navidrome.db is not set")
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
    try:
        rows = conn.execute(
            """select s.submission_time, u.user_name, m.title, m.artist, m.album_artist, m.album, m.album_id, m.duration, m.path
               from scrobbles s join media_file m on m.id = s.media_file_id join user u on u.id = s.user_id
               order by s.submission_time desc limit 200"""
        ).fetchall()
        users = conn.execute("select count(*) from user").fetchone()[0]
    finally:
        conn.close()
    if not rows:
        return {"ok": True, "playing": False, "last": None, "stack": []}
    now = int(time.time())
    stack, seen = [], {}
    for when, user, title, artist, album_artist, album, album_id, duration, path in rows:
        if album_id in seen:
            seen[album_id]["plays"] += 1
            continue
        paths[album_id] = path
        item = {"album": album, "artist": album_artist or artist, "album_id": album_id, "when": when, "plays": 1, "cover": cover(album_id)}
        seen[album_id] = item
        if len(stack) < STACK:
            stack.append(item)
    when, user, title, artist, _, album, album_id, duration, _ = rows[0]
    return {
        "ok": True, "playing": now - when < (duration or 240) + 90, "now": now, "users": users,
        "last": {"title": title, "artist": artist, "album": album, "album_id": album_id, "when": when, "who": user if users > 1 else None, "cover": cover(album_id)},
        "stack": stack,
    }


def cover(album_id):
    return "/media/navidrome/cover?id=" + urllib.parse.quote(album_id)


def media(ctx, name, query):
    """The cover picture in the album's folder, for albums poll() has seen."""
    album_id = (query.get("id") or [""])[0]
    root, rel = ctx.config.get("music_root"), paths.get(album_id)
    if name != "cover" or not root or not rel:
        return None
    if album_id in covers:
        return covers[album_id]
    track = os.path.realpath(os.path.join(root, rel))
    if not track.startswith(os.path.realpath(root) + os.sep):
        return None
    folder, found = os.path.dirname(track), None
    for entry in sorted(os.listdir(folder)):
        full = os.path.join(folder, entry)
        if COVER_NAMES.match(entry) and os.path.isfile(full) and os.path.getsize(full) < 4_000_000:
            with open(full, "rb") as f:
                found = (f.read(), "image/png" if entry.lower().endswith("png") else "image/jpeg")
            break
    found = found or embedded(track)
    covers[album_id] = found
    while len(covers) > 40:
        covers.pop(next(iter(covers)))
    return found


def embedded(track):
    """The picture stored inside the music file, read through ffmpeg into memory (nothing is written to disk)."""
    try:
        out = subprocess.run(["ffmpeg", "-v", "error", "-i", track, "-an", "-frames:v", "1", "-c:v", "copy", "-f", "image2pipe", "pipe:1"], capture_output=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    if out[:2] == b"\xff\xd8":
        return out, "image/jpeg"
    return (out, "image/png") if out[:4] == b"\x89PNG" else None
