"""Pi-hole (v6): how much it is blocking, for the bouncer at the door.

Needs secrets/pihole_password. One login is kept and reused (Pi-hole limits how many sessions exist), and
a fresh one is made when it expires. Only GET requests are made after the login.
"""
import json
import urllib.error
import urllib.request

NAME = "pihole"
EVERY = 10
session = {"sid": None, "blocked": None}


def base(ctx):
    return (ctx.config.get("url") or "http://pi.hole").rstrip("/") + "/api/"


def login(ctx):
    password = ctx.secret("pihole_password")
    if not password:
        raise RuntimeError("secrets/pihole_password is missing")
    req = urllib.request.Request(base(ctx) + "auth", data=json.dumps({"password": password}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=8) as r:
        session["sid"] = json.load(r)["session"]["sid"]


def call(ctx, path, again=True):
    if not session["sid"]:
        login(ctx)
    try:
        with urllib.request.urlopen(urllib.request.Request(base(ctx) + path, headers={"sid": session["sid"]}), timeout=8) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 401 and again:  # the session ran out
            session["sid"] = None
            return call(ctx, path, False)
        raise


def poll(ctx):
    summary = call(ctx, "stats/summary")
    q, clients = summary["queries"], summary["clients"]
    top = call(ctx, "stats/top_domains?blocked=true&count=5")["domains"]
    blocking = call(ctx, "dns/blocking")["blocking"]
    # How many more were blocked since the last look, for the tokens bouncing off the door (the totals cover 24 hours).
    fresh = max(0, q["blocked"] - session["blocked"]) if session["blocked"] is not None else 0
    session["blocked"] = q["blocked"]
    return {
        "ok": True, "blocking": blocking, "total": q["total"], "blocked": q["blocked"], "percent": round(q["percent_blocked"], 1),
        "clients": clients["active"], "fresh_blocked": min(fresh, 400), "top_blocked": [{"domain": d["domain"], "count": d["count"]} for d in top],
    }
