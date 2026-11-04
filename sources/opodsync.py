"""Opodsync (podcast sync): the episode that was played or synced last, for the radio.

Reads the sync server's own database read-only. Its `episodes_actions` table is what the podcast apps report (play, download); the
episode's title and cover are looked up in the podcast's public feed, which this source fetches (at most once an hour per podcast)
because Opodsync only keeps what the apps send. Config:
  "sources": {"opodsync": {"db": "/path/to/opodsync/data/data.sqlite", "open": "http://host:8765"}}
"""
import ipaddress
import json
import sqlite3
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

NAME = "opodsync"
EVERY = 30
ITUNES = "{http://www.itunes.com/dtds/podcast-1.0.dtd}"
feeds = {}  # feed url -> (fetched at, parsed feed)
covers = {}  # cover url -> (fetched at, (bytes, type)) for the one cover poll() last chose
current = {"cover": None}


def public_url(url):
    """Only web addresses with a real hostname: a feed must not be able to point the server at an address inside the house."""
    parts = urllib.parse.urlparse(url or "")
    host = parts.hostname or ""
    if parts.scheme not in ("http", "https") or not host or host == "localhost" or host.endswith((".local", ".internal", ".lan")):
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        return True


def feed_info(url):
    got = feeds.get(url)
    if got and time.time() - got[0] < 3600:
        return got[1]
    info = {"title": "", "image": "", "items": {}}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "media-server-dashboard (podcast cover lookup)"})
        with urllib.request.urlopen(req, timeout=10) as r:
            root = ET.fromstring(r.read(6_000_000))
        ch = root.find("channel")
        if ch is not None:
            info["title"] = (ch.findtext("title") or "").strip()
            img = ch.find(ITUNES + "image")
            info["image"] = (img.get("href") if img is not None else "") or (ch.findtext("image/url") or "")
            for item in ch.findall("item")[:300]:
                guid = (item.findtext("guid") or "").strip()
                pic = item.find(ITUNES + "image")
                info["items"][guid] = {"title": (item.findtext("title") or "").strip(), "image": pic.get("href") if pic is not None else ""}
    except Exception:
        pass  # keep whatever we have: the radio then shows the plain facts
    feeds[url] = (time.time(), info)
    return info


def poll(ctx):
    db = ctx.config.get("db")
    if not db:
        raise RuntimeError("sources.opodsync.db is not set")
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
    try:
        row = conn.execute(
            """select a.url, a.changed, a.action, a.data, s.url, d.name from episodes_actions a
               left join subscriptions s on s.id = a.subscription left join devices d on d.deviceid = a.device
               order by a.changed desc limit 1""").fetchone()
        week = conn.execute("select count(*) from episodes_actions where action = 'play' and changed > ?", (time.time() - 7 * 86400,)).fetchone()[0]
        podcasts = conn.execute("select count(*) from subscriptions where deleted = 0").fetchone()[0]
        title = None
        if row:
            title = conn.execute("select title from episodes where media_url = ?", (row[0],)).fetchone()
    finally:
        conn.close()
    if not row:
        return {"ok": True, "last": None, "podcasts": podcasts, "plays_week": week}
    media_url, changed, action, data, feed_url, device = row
    data = json.loads(data or "{}")
    info = feed_info(feed_url) if feed_url else {"title": "", "image": "", "items": {}}
    item = info["items"].get(data.get("guid") or "", {})
    cover = item.get("image") or info["image"] or ""
    current["cover"] = cover if public_url(cover) else None
    return {
        "ok": True, "podcasts": podcasts, "plays_week": week,
        "last": {
            "podcast": info["title"] or urllib.parse.urlparse(feed_url or media_url).hostname or "podcast",
            "episode": item.get("title") or (title and title[0]) or "an episode",
            "action": action, "when": changed, "device": data.get("device") or device or "",
            "position": data.get("position"), "total": data.get("total"),
            "cover": "/media/opodsync/cover?t=" + str(changed) if current["cover"] else None,
        },
    }


def media(ctx, name, query):
    """The cover of the episode poll() chose last (the address comes from the feed, never from the browser)."""
    url = current["cover"]
    if name != "cover" or not url:
        return None
    got = covers.get(url)
    if got and time.time() - got[0] < 86400:
        return got[1]
    req = urllib.request.Request(url, headers={"User-Agent": "media-server-dashboard (podcast cover lookup)"})
    with urllib.request.urlopen(req, timeout=10) as r:
        body, kind = r.read(3_000_000), r.headers.get_content_type()
    if not kind.startswith("image/"):
        return None
    covers.clear()
    covers[url] = (time.time(), (body, kind))
    return body, kind
