"""Home Assistant: the thermostat, the electricity price and the living room lights, for the radiator, the price ticker and the office lamps.

Needs secrets/ha_token (a long-lived access token) and in config.json, for example:
  "sources": {"homeassistant": {"url": "http://localhost:8123", "climate": "climate.living_room", "price": "sensor.electricity_price",
                                "price_forecast": "sensor.price_forecast", "light_prefix": "light.living_room"}}
Every entity is optional; what is not set is left out. For a heat pump you can name "compressor" (a sensor above 0 while it runs) and/or
"heat_power" (its heat output in kW); the radiator then glows while the pump really heats, instead of when the room is merely below its target.

Two more optional blocks feed the garden props (office_props/garden.js):
  "solar": {"power": "sensor.solar_current_power", "lifetime": "sensor.solar_lifetime_energy", "today": "sensor.solar_energy_today"}
  "heatpump": {"electric_power": .., "cop": .., "cop_today": .., "heat_today": .., "electric_today": .., "outdoor": .., "leaving_water": ..,
               "defrost": "binary_sensor..", "hot_water": "binary_sensor.. (on while it makes hot water)", "fan": .., "error": ..}
(the heat pump block reuses "compressor" and "heat_power" from above). A solar sensor that is "unavailable" means the inverter is asleep.
"""
from datetime import datetime

NAME = "homeassistant"
EVERY = 20
seen_peak = {"w": 0.0}  # the most solar power seen since the server started, to scale the panels' glow
UNITS = {"W": 1, "kW": 1000, "MW": 1e6, "Wh": 1, "kWh": 1000, "MWh": 1e6}


def reading(states, entity, per=1):
    """A sensor's number, converted to a base unit and then divided by `per` (e.g. watts to kW); None when missing or unavailable."""
    s = states.get(entity or "")
    if not s or s["state"] in ("unknown", "unavailable", ""):
        return None
    try:
        return float(s["state"]) * UNITS.get(s["attributes"].get("unit_of_measurement"), 1) / per
    except ValueError:
        return None


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
        # Is the room being heated? Best from the heat pump itself (compressor running or heat output above zero); otherwise the room being below its target.
        num = lambda key: next((float(s["state"]) for s in [states.get(cfg.get(key) or "")] if s and s["state"] not in ("unknown", "unavailable", "")), None)
        compressor, power = num("compressor"), num("heat_power")
        t = out["thermostat"]
        if compressor is not None or power is not None:
            t["heating"] = (compressor or 0) > 0 or (power or 0) > 0.05
        else:
            t["heating"] = c["state"] == "heat" and None not in (t["target"], t["current"]) and t["target"] > t["current"] + 0.1
    p = states.get(cfg.get("price") or "")
    if p and p["state"] not in ("unknown", "unavailable"):
        a = p["attributes"]
        out["price"] = {"now": float(p["state"]), "unit": a.get("unit_of_measurement"), "min": a.get("min_price"), "max": a.get("max_price"), "avg": a.get("avg_price"), "rank": a.get("intraday_price_ranking")}
        f = states.get(cfg.get("price_forecast") or "")
        hourly = (f or {}).get("attributes", {}).get("hourly") or []
        now = datetime.now().astimezone().replace(minute=0, second=0, microsecond=0)
        ahead = [h for h in hourly if isinstance(h, dict) and h.get("p") is not None and datetime.fromisoformat(h["t"]) >= now]
        out["price"]["hourly"] = [{"t": h["t"], "p": h["p"]} for h in ahead[:24]]
    solar = cfg.get("solar")
    if solar:
        watts = reading(states, solar.get("power"))
        seen_peak["w"] = max(seen_peak["w"], watts or 0)
        out["solar"] = {
            "asleep": watts is None, "watts": watts or 0, "peak": max(3000.0, seen_peak["w"]),
            "lifetime_kwh": reading(states, solar.get("lifetime"), 1000), "today_kwh": reading(states, solar.get("today"), 1000),
        }
    hp = cfg.get("heatpump")
    if hp:
        on = lambda key: (states.get(hp.get(key) or "") or {}).get("state") == "on"
        err = states.get(hp.get("error") or "")
        compressor = reading(states, cfg.get("compressor"))
        out["heatpump"] = {
            "running": (compressor or 0) > 0, "compressor": compressor, "heat_kw": reading(states, cfg.get("heat_power"), 1000),
            "electric_w": reading(states, hp.get("electric_power")), "cop": reading(states, hp.get("cop")), "cop_today": reading(states, hp.get("cop_today")),
            "heat_today_kwh": reading(states, hp.get("heat_today"), 1000), "electric_today_kwh": reading(states, hp.get("electric_today"), 1000),
            "outdoor": reading(states, hp.get("outdoor")), "leaving_water": reading(states, hp.get("leaving_water")), "fan": reading(states, hp.get("fan")),
            "defrost": on("defrost"), "hot_water": on("hot_water"),
            "error": err["state"] if err and err["state"] not in ("Normal", "unknown", "unavailable", "-", "", "0") else None,
        }
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
