"""Linkwarden (bookmarks): the newest saved links, for the cork pinboard.

Asks Linkwarden's own database inside its Docker container (read-only select, no API token needed). Config:
  "sources": {"linkwarden": {"container": "linkwarden-db", "user": "linkwarden", "database": "linkwarden", "open": "http://host:3010"}}
Anything saved to Linkwarden shows up, whether you added it in the web app or sent it from your phone.
"""
import re
import urllib.parse

NAME = "linkwarden"
EVERY = 30
NOTES = 14
SEP = "\x1f"


def poll(ctx):
    cfg = ctx.config
    sql = f'select id, regexp_replace(name, E\'[\\n\\r\\t]+\', \' \', \'g\'), coalesce(url, \'\'), extract(epoch from "createdAt")::bigint from "Link" order by id desc limit {NOTES}'
    out = ctx.sh("/usr/bin/docker", "exec", cfg.get("container") or "linkwarden-db", "psql", "-U", cfg.get("user") or "linkwarden", "-d", cfg.get("database") or "linkwarden",
                 "-At", "-F", SEP, "-c", sql, timeout=30)
    total = ctx.sh("/usr/bin/docker", "exec", cfg.get("container") or "linkwarden-db", "psql", "-U", cfg.get("user") or "linkwarden", "-d", cfg.get("database") or "linkwarden",
                   "-At", "-c", 'select count(*) from "Link"', timeout=30).strip()
    notes = []
    for line in out.splitlines():
        parts = line.split(SEP)
        if len(parts) != 4 or not parts[0].isdigit():
            continue
        host = re.sub(r"^www\.", "", urllib.parse.urlparse(parts[2]).hostname or "")
        notes.append({"id": int(parts[0]), "title": (parts[1].strip() or host or "untitled")[:90], "host": host, "added": int(parts[3] or 0)})
    return {"ok": True, "total": int(total) if total.isdigit() else len(notes), "notes": notes}
