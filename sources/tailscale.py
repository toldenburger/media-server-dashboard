"""Tailscale: which devices on the tailnet are online, for the switchboard operator.

Reads `tailscale status --json` from the local daemon. Device names only go to logged-in browsers.
"""
import json

NAME = "tailscale"
EVERY = 30


def poll(ctx):
    raw = ctx.sh("/usr/bin/tailscale", "status", "--json", timeout=10)
    data = json.loads(raw)
    peers = [{"name": p.get("HostName") or "?", "os": (p.get("OS") or "").lower(), "online": bool(p.get("Online")), "active": bool(p.get("Active"))} for p in data.get("Peer", {}).values()]
    peers.sort(key=lambda p: (not p["online"], not p["active"], p["name"].lower()))
    return {
        "ok": data.get("BackendState") == "Running", "self": data["Self"].get("HostName"), "total": len(peers),
        "online": sum(1 for p in peers if p["online"]), "devices": peers[:40],
    }
