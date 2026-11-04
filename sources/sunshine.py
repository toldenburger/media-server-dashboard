"""Sunshine (game streaming host): is someone streaming right now, and what, for the gaming TV and console.

Reads Sunshine's own log, read-only and without any login. A session starts at a "CLIENT CONNECTED" line and ends at "CLIENT DISCONNECTED";
the app that was launched is named in an "Executing [App]" line just before. Paired device names come from its state file.
Config: "sources": {"sunshine": {"folder": "~/.config/sunshine", "open": "https://<this computer>:47990"}}  (folder defaults to ~/.config/sunshine)
"""
import json
import os
import re
import time
from datetime import datetime

NAME = "sunshine"
EVERY = 10
LINE = re.compile(r"^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+\]: \w+: (.*)$")


def stamp(text):
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S").timestamp()


def running():
    for pid in (p for p in os.listdir("/proc") if p.isdigit()):
        try:
            with open(f"/proc/{pid}/comm", encoding="utf-8") as fh:
                if fh.read().strip() == "sunshine":
                    return True
        except OSError:
            continue
    return False


def poll(ctx):
    folder = os.path.expanduser(ctx.config.get("folder") or "~/.config/sunshine")
    logs = [os.path.join(folder, n) for n in ("sunshine.log.4", "sunshine.log.3", "sunshine.log.2", "sunshine.log.1", "sunshine.log")]
    events = []  # (time, kind, detail), oldest first
    app = None
    for path in logs:
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                for raw in fh:
                    m = LINE.match(raw.rstrip("\n"))
                    if not m:
                        continue
                    when, msg = stamp(m.group(1)), m.group(2)
                    launched = re.match(r"Executing \[(.+)\]$", msg)
                    if launched:
                        app = launched.group(1)
                    elif msg == "CLIENT CONNECTED":
                        events.append((when, "connected", app))
                    elif msg == "CLIENT DISCONNECTED":
                        events.append((when, "disconnected", None))
        except OSError:
            continue
    now = time.time()
    last_connect = next((e for e in reversed(events) if e[1] == "connected"), None)
    last_end = next((e for e in reversed(events) if e[1] == "disconnected"), None)
    up = running()
    streaming = bool(up and last_connect and (not last_end or last_connect[0] > last_end[0]))
    clients = []
    try:
        with open(os.path.join(folder, "sunshine_state.json"), encoding="utf-8") as fh:
            clients = [c.get("name") for c in json.load(fh).get("root", {}).get("named_devices", []) if c.get("name")]
    except (OSError, ValueError):
        pass
    return {
        "ok": True, "running": up, "streaming": streaming,
        "app": last_connect[2] if streaming and last_connect else None, "since": last_connect[0] if streaming else None,
        "clients": clients, "sessions_week": sum(1 for e in events if e[1] == "connected" and now - e[0] < 7 * 86400),
        "last_session": last_end[0] if last_end else None, "now": now,
    }
