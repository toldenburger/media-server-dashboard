"""Home Assistant: the thermostat, the electricity price and the living room lights, for the radiator, the price ticker and the office lamps.

Needs secrets/ha_token (a long-lived access token) and in config.json, for example:
  "sources": {"homeassistant": {"url": "http://localhost:8123", "climate": "climate.living_room", "price": "sensor.electricity_price",
                                "price_forecast": "sensor.price_forecast", "light_prefix": "light.living_room"}}
Every entity is optional; what is not set is left out.
"""
from datetime import datetime

NAME = "homeassistant"
EVERY = 20


def poll(ctx):
    cfg = ctx.config
    base = (cfg.get("url") or "http://localhost:8123").rstrip("/")
    states = {s["entity_id"]: s for s in ctx.get_json(base + "/api/states", {"Authorization": "Bearer " + ctx.secret("ha_token")}, timeout=12)}
    out = {"ok": True}
    c = states.get(cfg.get("climate") or "")
    if c:
        a = c["attributes"]
        out["thermostat"] = {"current": a.get("current_temperature"), "target": a.get("temperature"), "mode": c["state"], "action": a.get("hvac_action")}
        w = states.get(cfg.get("water_heater") or "")
        if w:
            out["thermostat"]["water"] = w["state"]
    p = states.get(cfg.get("price") or "")
    if p and p["state"] not in ("unknown", "unavailable"):
        a = p["attributes"]
        out["price"] = {"now": float(p["state"]), "unit": a.get("unit_of_measurement"), "min": a.get("min_price"), "max": a.get("max_price"), "avg": a.get("avg_price"), "rank": a.get("intraday_price_ranking")}
        f = states.get(cfg.get("price_forecast") or "")
        hourly = (f or {}).get("attributes", {}).get("hourly") or []
        now = datetime.now().astimezone().replace(minute=0, second=0, microsecond=0)
        ahead = [h for h in hourly if isinstance(h, dict) and h.get("p") is not None and datetime.fromisoformat(h["t"]) >= now]
        out["price"]["hourly"] = [{"t": h["t"], "p": h["p"]} for h in ahead[:24]]
    prefix = cfg.get("light_prefix")
    if prefix:
        on = [s for e, s in states.items() if e.startswith(prefix) and s["state"] == "on"]
        if on:
            rgb = [sum((s["attributes"].get("rgb_color") or [255, 214, 170])[i] for s in on) / len(on) for i in range(3)]
            bright = sum(s["attributes"].get("brightness") or 255 for s in on) / len(on) / 255
            out["lamps"] = {"on": len(on), "brightness": round(bright, 2), "rgb": [round(x) for x in rgb]}
        else:
            out["lamps"] = {"on": 0, "brightness": 0, "rgb": [255, 214, 170]}
    return out
