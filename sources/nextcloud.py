"""Nextcloud: how full the storage is, for the filing cabinet.

Asks Nextcloud's own command line (occ) inside its Docker container, so no password or token is needed. Config:
  "sources": {"nextcloud": {"container": "nextcloud", "user": "name-of-the-account-to-show"}}
"""
import re

NAME = "nextcloud"
EVERY = 120


def poll(ctx):
    container = ctx.config.get("container") or "nextcloud"
    occ = ["/usr/bin/docker", "exec", "-u", "www-data", container, "php", "occ"]
    user = ctx.config.get("user")
    people = re.findall(r"^\s*-\s*([^:]+):", ctx.sh(*occ, "user:list", timeout=30), re.M)
    user = user or next((u for u in people if u != "admin"), people[0] if people else None)
    info = ctx.sh(*occ, "user:info", user, timeout=30) if user else ""
    num = lambda name: int((re.search(rf"^\s*-\s*{name}:\s*(-?\d+)", info, re.M) or [0, 0])[1])
    total = num("total")
    if not total:
        return {"ok": False}
    return {"ok": True, "users": len(people), "used": num("used"), "free": num("free"), "total": total, "percent": round(num("used") / total * 100, 2)}
