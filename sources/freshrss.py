"""FreshRSS: unread articles, for the newspaper stack.

Uses FreshRSS's own command line inside its Docker container, so no password is needed. Config:
  "sources": {"freshrss": {"container": "freshrss", "user": "the-freshrss-user", "cli": "/app/www/cli/user-info.php"}}
"""
NAME = "freshrss"
EVERY = 120


def poll(ctx):
    cfg = ctx.config
    out = ctx.sh("/usr/bin/docker", "exec", cfg.get("container") or "freshrss", "php", cfg.get("cli") or "/app/www/cli/user-info.php", "--user", cfg.get("user") or "admin", "--header", timeout=30)
    rows = [[c.strip() for c in line.split("|")] for line in out.splitlines() if "|" in line]
    if len(rows) < 2:
        return {"ok": False}
    row = dict(zip([h.lower() for h in rows[0]], rows[1]))
    num = lambda *names: next((int(row[n]) for n in names if n in row and row[n].lstrip("-").isdigit()), 0)
    return {"ok": True, "unread": num("unreads", "unread"), "feeds": num("feeds"), "read": num("reads", "read"), "favourites": num("favourites", "favorites")}
