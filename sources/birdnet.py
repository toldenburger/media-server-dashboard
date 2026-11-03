"""BirdNET-Go on the Raspberry Pi: the top bird today and the newest rare bird of the week, for the two windows.

"Rare" is whatever BirdNET-Go's own "New species" and "Infrequent species" alert rules fired for, the same
thing that sends the desktop and HomePod alerts, so the window and the alerts always agree.
"""
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

NAME = "birdnet"
EVERY = 60
RARE_RULES = (1, 2)  # BirdNET-Go built-in rules: 1 = new species, 2 = infrequent species
RARE_KIND = {1: "new", 2: "infrequent"}
photos = {}


def base(ctx):
    return (ctx.config.get("url") or "http://localhost:8080").rstrip("/") + "/api/v2/"


def api(ctx, path):
    return ctx.get_json(base(ctx) + path, timeout=10)


def image(name):
    return "/media/birdnet/image?name=" + urllib.parse.quote(name)


def poll(ctx):
    today = datetime.now().strftime("%Y-%m-%d")
    daily = api(ctx, f"analytics/species/daily?date={today}")
    names = {s["scientific_name"]: s["common_name"] for s in api(ctx, "analytics/species/summary")}
    top = max(daily, key=lambda s: s["count"]) if daily else None
    out = {
        "ok": True,
        "species_today": len(daily),
        "detections_today": sum(s["count"] for s in daily),
        "top": top and {
            "name": top["common_name"], "scientific": top["scientific_name"], "count": top["count"],
            "last_heard": top.get("latest_heard"), "confidence": top.get("max_confidence"), "image": image(top["scientific_name"]),
        },
    }
    history = [h for h in api(ctx, "alerts/history?limit=100").get("history", []) if h.get("rule_id") in RARE_RULES]
    history.sort(key=lambda h: h["fired_at"], reverse=True)
    out["rare"] = None
    if history:
        h = history[0]
        ev = json.loads(h["event_data"])
        sci = ev.get("scientific_name") or ""
        fired = datetime.fromisoformat(re.sub(r"\.\d+", "", h["fired_at"]))  # BirdNET-Go writes nanoseconds; drop them
        out["rare"] = {
            "name": names.get(sci) or ev.get("common_name") or sci, "scientific": sci, "when": fired.isoformat(),
            "kind": RARE_KIND.get(h["rule_id"], "rare"), "confidence": ev.get("confidence"),
            "this_week": datetime.now(timezone.utc) - fired < timedelta(days=7), "image": image(sci),
        }
    last = api(ctx, "detections?numResults=1&queryType=all").get("data", [])
    out["latest"] = (last and {"id": last[0]["id"], "name": last[0]["commonName"], "time": last[0]["time"], "confidence": last[0]["confidence"]}) or None
    return out


def media(ctx, name, query):
    """Species photos, fetched here because phones on Tailscale can't reach a .local hostname."""
    sci = (query.get("name") or [""])[0]
    if name != "image" or not re.fullmatch(r"[A-Za-z][A-Za-z .'-]{2,80}", sci):
        return None
    if sci not in photos or time.time() - photos[sci][2] > 86400:
        with urllib.request.urlopen(base(ctx) + "media/image/" + urllib.parse.quote(sci), timeout=10) as r:
            photos[sci] = (r.read(3_000_000), r.headers.get("Content-Type", "image/jpeg"), time.time())
        while len(photos) > 30:
            photos.pop(next(iter(photos)))
    return photos[sci][0], photos[sci][1]
