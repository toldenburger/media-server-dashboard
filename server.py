#!/usr/bin/python3
"""Media server dashboard and 3D office, ported from macOS to Linux. Standard library only.

Watches the machine and the apps on it strictly from the outside: system tools and each app's own API
(Mediarium: movies, TV, downloads, subtitles, indexers). Everyone needs the password in password.txt, localhost included;
it listens only on the addresses in config.json "bind" (default 127.0.0.1). API keys stay in here; only the fields picked out below reach the browser.

    python3 server.py          watch this Mac
    python3 server.py --demo   made-up data, for trying it out or taking screenshots
"""
import hashlib
import hmac
import importlib.util
import html
import http.cookies
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.expanduser("~")
DEMO = "--demo" in sys.argv


def _settings():
    """config.json next to this file, if there is one. Every setting is optional; see config.example.json."""
    try:
        with open(os.path.join(HERE, "config.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


CONFIG = _settings()
PORT = int(CONFIG.get("port") or 8900)
BIND = CONFIG.get("bind") or ["127.0.0.1"]  # addresses to listen on; use the Tailscale IP for tailnet-only access
TITLE = CONFIG.get("title") or "Media Server Dashboard"
MEDIARIUM_URL = (CONFIG.get("mediarium_url") or "http://127.0.0.1:8264").rstrip("/")
MEDIARIUM_KEY_FILE = os.path.expanduser(CONFIG.get("mediarium_key_file") or os.path.join(HERE, "mediarium_api_key"))  # API key, one line, mode 600
MEDIARIUM_CONTAINER = CONFIG.get("mediarium_container") or "mediarium"

PASSWORD_FILE = os.path.join(HERE, "password.txt")  # change it any time; it applies straight away and signs everyone out
SECRET_FILE = os.path.join(HERE, ".secret")
VENDOR = {"/vendor/three.module.min.js": "three.module.min.js", "/vendor/OrbitControls.js": "OrbitControls.js", "/vendor/RoundedBoxGeometry.js": "RoundedBoxGeometry.js"}  # the 3D office's library, served as-is
POSTER_HOSTS = ("https://image.tmdb.org/", "https://artworks.thetvdb.com/")
poster_cache = {}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # a poster host must not be able to bounce us to another host
        return None


NO_REDIRECT = urllib.request.build_opener(_NoRedirect)
MAX_ATTEMPTS = 8
LOCKOUT = 5 * 60

TICK = 2            # seconds between system samples
KEEP = 150          # samples kept: 5 minutes

history = {k: deque(maxlen=KEEP) for k in ("t", "cpu", "mem", "rx", "tx", "disk", "sab", "mcpu", "mmem")}
state = {"system": {}, "services": [], "cinema": {"enabled": False, "profiles": [], "streams": [], "watched": [], "missing_drives": []}, "sab": {"ok": False}, "radarr": {"ok": False}, "sonarr": {"ok": False}, "prowlarr": {"ok": False}, "bazarr": {"ok": False}, "activity": {}, "network": {}, "disks": [], "med_health": [], "mediarium": {"ok": False}, "extra": {}}


def sh(*args, timeout=5):
    try:
        return subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout).stdout
    except (subprocess.SubprocessError, OSError):
        return ""


def get_json(url, headers=None, timeout=6):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=timeout) as r:
        return json.load(r)


def read_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


# ---------- the machine, every couple of seconds ----------
net_last = {}
cpu_last = {}
disk_last = {}
NET_IFACE = re.compile(r"(en|eth|wl)\w*")  # physical NICs only, not lo, docker, veth, tailscale


def proc(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def sample_network():
    rx = tx = 0
    for line in proc("/proc/net/dev").splitlines()[2:]:
        name, _, data = line.partition(":")
        p = data.split()
        if NET_IFACE.fullmatch(name.strip()) and len(p) >= 9:
            rx += int(p[0])
            tx += int(p[8])
    now = time.time()
    rates = (0, 0)
    if net_last and now > net_last["t"]:
        dt = now - net_last["t"]
        rates = (max(0, rx - net_last["rx"]) / dt, max(0, tx - net_last["tx"]) / dt)
    net_last.update(t=now, rx=rx, tx=tx)
    return rates


def sample_memory():
    info = {k: int(v.split()[0]) * 1024 for k, _, v in (ln.partition(":") for ln in proc("/proc/meminfo").splitlines()) if v.strip()}
    total = info.get("MemTotal", 1)
    avail = info.get("MemAvailable", total)
    return {
        "total": total, "used": total - avail,
        "free_level": round(avail / total * 100),
        "swap_total": info.get("SwapTotal", 0), "swap_used": info.get("SwapTotal", 0) - info.get("SwapFree", 0),
    }


def sample_cpu():
    """User, system and idle percent since the last call, from /proc/stat."""
    v = [int(x) for x in proc("/proc/stat").splitlines()[0].split()[1:9]]  # user nice system idle iowait irq softirq steal
    user, system, idle = v[0] + v[1], v[2] + v[5] + v[6], v[3] + v[4]
    total = user + system + idle + v[7]
    prev = cpu_last.copy()
    cpu_last.update(user=user, system=system, idle=idle, total=total)
    if not prev or total <= prev["total"]:
        return None
    d = total - prev["total"]
    return (user - prev["user"]) / d * 100, (system - prev["system"]) / d * 100, (idle - prev["idle"]) / d * 100


def sample_disk_bytes_per_sec():
    sectors = 0
    for ln in proc("/proc/diskstats").splitlines():
        p = ln.split()
        if len(p) >= 10 and re.fullmatch(r"sd[a-z]+|nvme\d+n\d+|mmcblk\d+", p[2]):
            sectors += int(p[5]) + int(p[9])
    now = time.time()
    rate = 0
    if disk_last and now > disk_last["t"]:
        rate = max(0, sectors - disk_last["s"]) * 512 / (now - disk_last["t"])
    disk_last.update(t=now, s=sectors)
    return rate


def system_loop():
    while True:
        started = time.time()
        cpu = sample_cpu()
        disk = sample_disk_bytes_per_sec()
        if cpu:
            us, sy, idle = cpu
            load = [float(x) for x in proc("/proc/loadavg").split()[:3]]
            mem = sample_memory()
            rx, tx = sample_network()
            history["t"].append(int(time.time() * 1000))
            history["cpu"].append(round(100 - idle))
            history["mem"].append(round(mem["used"] / mem["total"] * 100, 1))
            history["rx"].append(round(rx))
            history["tx"].append(round(tx))
            history["disk"].append(disk)
            history["sab"].append(state["sab"].get("speed", 0))
            history["mcpu"].append(state["mediarium"].get("cpu", 0))
            history["mmem"].append(state["mediarium"].get("mem", 0))
            state["system"].update(cpu={"user": us, "system": sy, "idle": idle}, load=load, memory=mem)
        time.sleep(max(0.1, TICK - (time.time() - started)))


def looped(every, fn):
    def run():
        while True:
            try:
                fn()
            except Exception as e:  # one bad reading must not stop the dashboard
                print(f"{fn.__name__}: {type(e).__name__}", flush=True)
            time.sleep(every)
    threading.Thread(target=run, daemon=True).start()


def read_static():
    cpu_name = next((ln.partition(":")[2].strip() for ln in proc("/proc/cpuinfo").splitlines() if ln.startswith("model name")), "")
    os_name = next((ln.partition("=")[2].strip().strip('"') for ln in proc("/etc/os-release").splitlines() if ln.startswith("PRETTY_NAME=")), "Linux")
    uptime = float((proc("/proc/uptime").split() or ["0"])[0])
    state["system"].update(
        host=socket.gethostname().split(".")[0],
        cpu_name=cpu_name, cores=os.cpu_count() or 1,
        macos=os_name, model=proc("/sys/class/dmi/id/product_name").strip(),
        booted=int((time.time() - uptime) * 1000),
    )


def read_disks():
    disks = {}
    for ln in sh("/bin/df", "-kl", "--output=size,avail,target").splitlines()[1:]:
        m = re.match(r"\s*(\d+)\s+(\d+)\s+(/.*)$", ln)
        if not m or int(m[1]) < 1048576:
            continue
        mount = m[3]
        if mount == "/":
            name = "System"
        elif mount.startswith("/run/media/"):
            name = mount.split("/")[-1]
        else:
            continue
        disks[name] = {"name": name, "total": int(m[1]) * 1024, "free": int(m[2]) * 1024}
    state["disks"] = list(disks.values())


def read_network():
    route = sh("/usr/bin/ip", "-4", "route", "get", "1.1.1.1")
    iface = (re.search(r"dev (\S+)", route) or [None, ""])[1]
    lan = (re.search(r"src (\S+)", route) or [None, ""])[1]
    ping = sh("/usr/bin/ping", "-c", "1", "-W", "2", "1.1.1.1", timeout=4)
    ms = re.search(r"time=([\d.]+)", ping)
    state["network"] = {"lan": lan, "vpn": iface.startswith(("tailscale", "wg", "tun")), "online": bool(ms), "ping": float(ms[1]) if ms else None}
    state["system"]["speed_limit"] = 100  # macOS reported thermal throttling here; not read on Linux


# ---------- apps ----------
# ---------- Mediarium: one app, shown as five office workers ----------
# Each worker is a role Mediarium plays. Keys are the names the pages use for the data (kept from the original arr layout).
KEYS = {"Movies": "radarr", "TV": "sonarr", "Indexers": "prowlarr", "Subtitles": "bazarr", "Downloads": "sab"}
STATS_FILE = os.path.join(HERE, "stats.json")
med = {"at": {}, "data": {}}
dl_last = {}      # queue id -> bytes done at the last reading, to work out the speed
dl_totals = {"days": {}}
download_titles = {}  # queue id -> the movie or episode it is
download_owner = {}   # queue id -> "Movies", "TV" or "Downloads"


def mget(path):
    with open(MEDIARIUM_KEY_FILE, encoding="utf-8") as f:
        key = f.read().strip()
    return get_json(MEDIARIUM_URL + path, {"X-API-Key": key}, timeout=10)


def cached(path, ttl):
    if path not in med["at"] or time.time() - med["at"][path] > ttl:
        med["data"][path] = mget(path)
        med["at"][path] = time.time()
    return med["data"][path]


def hb(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def utc_ms(text):
    return datetime.strptime(text[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp() * 1000


def tidy(name):
    """A release file name made readable: 'Atlantis.The.Lost.Empire.2001.1080p...' becomes 'Atlantis The Lost Empire (2001)'."""
    n = re.sub(r"[._]+", " ", name).strip()
    ep = re.match(r"(.+?)\s+(S\d\d?E\d\d?)\b", n, re.I)
    if ep:
        return f"{ep[1].strip()} {ep[2].upper()}"
    year = re.match(r"(.+?)\s*[\(\[]?((?:19|20)\d\d)[\)\]]?(?:\s|$)", n)
    return f"{year[1].strip()} ({year[2]})" if year else n


def load_totals():
    dl_totals["days"] = (read_json(STATS_FILE) or {}).get("days", {})


def save_totals():
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump({"days": dl_totals["days"]}, f)
    except OSError:
        pass


def track_totals(delta):
    today = datetime.now().strftime("%Y-%m-%d")
    days = dl_totals["days"]
    days[today] = days.get(today, 0) + delta
    for old in sorted(days)[:-400]:
        del days[old]
    cut = lambda n: (datetime.now() - timedelta(days=n)).strftime("%Y-%m-%d")
    return {"day": days.get(today, 0), "week": sum(v for k, v in days.items() if k > cut(7)), "month": sum(v for k, v in days.items() if k > cut(30)), "total": sum(days.values())}


def all_down():
    for key in KEYS.values():
        state[key] = {"ok": False}
    state["services"] = [{"name": n, "up": False} for n in KEYS]
    state["activity"] = {}
    state["med_health"] = []


def read_mediarium():
    try:
        queue = mget("/api/queue?active=1")
        movies = cached("/api/movies?brief=1", 60)
        series = cached("/api/series?brief=1", 60)
        calendar = cached("/api/calendar", 60)
        events = cached("/api/activity?limit=300", 20)
        indexers = cached("/api/indexers", 120)
        health = cached("/api/health", 60)["items"]
    except (OSError, ValueError, KeyError, urllib.error.URLError):
        state["sab"] = {"ok": False}
        all_down()
        return
    now = datetime.now(timezone.utc)
    now_ms = time.time() * 1000
    stamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Downloads: Mediarium reports progress, not speed, so the speed is how much more is done since the last reading.
    t_last = dl_last.get("_t")
    done, items = {}, []
    owner, names = {}, {}
    for q in queue:
        qid = str(q["id"])
        title = " ".join(x for x in (q.get("title") or tidy(q.get("releaseTitle") or ""), q.get("subtitle")) if x)
        names[qid] = title
        owner[qid] = "Movies" if q.get("movieId") else "TV" if q.get("seriesId") else "Downloads"
        size = q.get("sizeBytes") or 0
        done[qid] = size * (q.get("progressPct") or 0) / 100
        items.append({"id": qid, "title": title, "pct": q.get("progressPct") or 0, "left": hb(max(0, size - done[qid])), "size": hb(size), "state": q.get("status"), "left_bytes": max(0, size - done[qid])})
    delta = sum(max(0, done[i] - dl_last.get(i, done[i])) for i in done)
    speed = delta / (time.time() - t_last) if t_last and time.time() > t_last else 0
    dl_last.clear()
    dl_last.update(done)
    dl_last["_t"] = time.time()
    totals = track_totals(delta)
    left = sum(i["left_bytes"] for i in items)
    eta = "-"
    if speed > 0 and left:
        mins = int(left / speed // 60)
        eta = f"{mins // 60}h {mins % 60:02d}m" if mins >= 60 else f"{mins}m"
    failed_week = sum(1 for e in events if e["eventType"] == "failed" and now_ms - utc_ms(e["createdAt"]) < 7 * 86400 * 1000)
    state["sab"] = {
        "ok": True, "paused": bool(items) and all(i["state"] in ("paused", "stopped") for i in items),
        "speed": speed, "left": left, "eta": eta, "queueTotal": len(items),
        "queue": [{k: v for k, v in i.items() if k != "left_bytes"} for i in items], "failed": failed_week, "totals": totals,
    }
    download_titles.clear(); download_titles.update(names)
    download_owner.clear(); download_owner.update(owner)

    # Recently added: what Mediarium imported lately, matched to the movie or show it belongs to.
    by_movie = {m["title"].lower(): m for m in movies}
    by_show = {s["title"].lower(): s for s in series}
    recent_movies, recent_shows, seen = [], [], set()
    for e in events:
        if e["eventType"] != "imported":
            continue
        name, _, rest = e["message"].partition(": imported ")
        m, s = by_movie.get(name.lower()), by_show.get(name.lower())
        if name.lower() in seen or not (m or s):
            continue
        seen.add(name.lower())
        if m and len(recent_movies) < 8:
            recent_movies.append({"title": m["title"], "year": m.get("year"), "poster": m.get("posterUrl"), "size": m.get("sizeBytes", 0), "quality": m.get("quality"), "when": e["createdAt"]})
        elif s and len(recent_shows) < 8:
            recent_shows.append({"title": s["title"], "sub": rest.split(" from ")[0], "poster": s.get("posterUrl"), "quality": None, "when": e["createdAt"]})

    # Movies with no import in the log (it only reaches back so far) fill the row, newest first.
    for m in sorted(movies, key=lambda m: m["id"], reverse=True):
        if len(recent_movies) >= 8:
            break
        if m.get("status") == "downloaded" and m["title"].lower() not in seen:
            recent_movies.append({"title": m["title"], "year": m.get("year"), "poster": m.get("posterUrl"), "size": m.get("sizeBytes", 0), "quality": m.get("quality"), "when": None})

    # Coming up: episodes and releases from the calendar, next 14 days.
    horizon = (now + timedelta(days=14)).strftime("%Y-%m-%dT%H:%M:%SZ")
    up_movies, up_shows, aired_missing = [], [], 0
    for c in calendar:
        when = c.get("airAt") or ((c.get("releaseDate") or "") + "T00:00:00Z")
        if c.get("kind") == "episode":
            if c.get("status") == "missing" and when < stamp:
                aired_missing += 1
            if stamp <= when <= horizon:
                up_shows.append({"kind": "Episode", "title": f"{c.get('title', '')} {(c.get('subtitle') or '').split(' ·')[0]}".strip(), "when": when})
        elif c.get("kind") == "movie" and stamp <= when <= horizon:
            up_movies.append({"kind": "Movie", "title": c.get("title"), "when": when})

    routed = {"radarr": [], "sonarr": [], "bazarr": [], "prowlarr": []}
    other = []
    for h in health:
        text = f"{h.get('id', '')} {h.get('title', '')}".lower()
        level = "error" if h.get("level") == "error" else "warning"
        target = "bazarr" if "subtitle" in text else "prowlarr" if "indexer" in text else None
        (routed[target] if target else other).append({"level": level, "message": h.get("title")})
    state["med_health"] = other

    have = [m for m in movies if m.get("status") == "downloaded"]
    state["radarr"] = {"ok": True, "library": {"total": len(movies), "have": len(have), "size": sum(m.get("sizeBytes", 0) for m in movies)}, "missing": len(movies) - len(have), "recent": recent_movies, "upcoming": up_movies, "health": routed["radarr"]}
    state["sonarr"] = {"ok": True, "library": {"total": len(series), "have": sum(s.get("downloadedCount", 0) for s in series), "episodes": sum(s.get("episodeCount", 0) for s in series), "size": sum(s.get("sizeBytes", 0) for s in series)}, "missing": aired_missing, "recent": recent_shows, "upcoming": up_shows, "health": routed["sonarr"]}
    state["prowlarr"] = {"ok": True, "indexers": len(indexers), "enabled": sum(1 for i in indexers if i.get("enabled")), "health": routed["prowlarr"]}
    state["bazarr"] = {"ok": True, "health": routed["bazarr"]}

    recent_event = lambda kind: any(e["eventType"] == kind and now_ms - utc_ms(e["createdAt"]) < 120 * 1000 for e in events)
    act = {"Indexers": "Searching for releases" if recent_event("grabbed") else None, "Subtitles": "Fetching subtitles" if recent_event("subtitle") else None}
    for who in ("Movies", "TV"):
        busy = next((i for i in items if owner[i["id"]] == who and i["state"] in ("downloading", "importing")), None)
        act[who] = f"{'Importing' if busy['state'] == 'importing' else 'Downloading'} {busy['title']} · {round(busy['pct'])}%" if busy else None
    state["activity"] = act
    state["services"] = [{"name": n, "up": True} for n in KEYS]


def read_container():
    """CPU and memory of the Mediarium container itself."""
    out = sh("/usr/bin/docker", "stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}", MEDIARIUM_CONTAINER, timeout=15).strip()
    m = re.match(r"([\d.]+)%\|([\d.]+)(\w+) /", out)
    if not m:
        state["mediarium"] = {"ok": False}
        return
    scale = {"B": 1, "KiB": 1024, "MiB": 1048576, "GiB": 1073741824}.get(m[3], 1)
    state["mediarium"] = {"ok": True, "cpu": float(m[1]), "mem": float(m[2]) * scale}


def up_next(name, n=5):
    """The next downloads in Mediarium's order, for the popup on a worker. Movies and TV get only their own."""
    if name not in ("Downloads", "Movies", "TV"):
        return []
    sab = state["sab"]
    out = []
    for s in sab.get("queue", []) if sab.get("ok") else []:
        if name != "Downloads" and download_owner.get(s["id"]) != name:
            continue
        out.append({"title": s["title"], "pct": round(s["pct"]), "size": s.get("size")})
        if len(out) == n:
            break
    return out


def activity(name):
    """The task a worker is busy with, or None when it has nothing to do."""
    if name == "Downloads":
        sab = state["sab"]
        if not sab.get("ok") or sab["paused"] or not (sab["speed"] > 0 or sab["queueTotal"]):
            return None
        top = sab["queue"][0] if sab["queue"] else None
        return f"Downloading {top['title']} · {round(top['pct'])}%" if top else "Downloading"
    return state["activity"].get(name)


# ---------- what needs attention ----------
def alerts():
    out = []
    add = lambda level, source, msg: out.append({"level": level, "source": source, "message": msg})
    for s in state["services"]:
        if not s["up"]:
            add("error", s["name"], "Not running")
    for h in state.get("med_health", []):
        add(h["level"], "Mediarium", h["message"])
    for name in ("Movies", "TV", "Subtitles", "Indexers"):
        for h in state[KEYS[name]].get("health", []):
            add(h["level"], name, h["message"])
    sab = state["sab"]
    if sab.get("ok"):
        if sab["paused"]:
            add("warning", "Downloads", "Downloads are paused")
        if sab["failed"]:
            add("warning", "Downloads", f"{sab['failed']} failed download(s) this week")
    for d in state["disks"]:
        if d["free"] / d["total"] < 0.1:
            add("warning", "Drives", f"{d['name']} is over 90% full")
    net = state["network"]
    if net and not net["online"]:
        add("error", "Network", "No internet connection")
    sysinfo = state["system"]
    if sysinfo.get("speed_limit", 100) < 100:
        add("warning", "CPU", f"Running hot: limited to {sysinfo['speed_limit']}% speed")
    if sysinfo.get("memory", {}).get("free_level", 100) < 10:
        add("warning", "Memory", "Memory is running low")
    recent = list(history["cpu"])[-30:]
    if len(recent) == 30 and min(recent) > 90:
        add("warning", "CPU", "Above 90% for the last minute")
    return out


def payload():
    upcoming = sorted(state["radarr"].get("upcoming", []) + state["sonarr"].get("upcoming", []), key=lambda u: u["when"])[:8]
    issues = alerts()
    services = [{**s, "issues": [a for a in issues if a["source"] == s["name"]], "task": activity(s["name"]) if s["up"] else None, "next": up_next(s["name"]) if s["up"] else []} for s in state["services"]]
    for mod in SOURCES.values():  # a source with SERVICE set also gets a worker at a desk
        who = getattr(mod, "SERVICE", None)
        if who:
            ex = state["extra"].get(mod.NAME) or {}
            services.append({"name": who, "up": bool(ex.get("ok")), "issues": [], "task": ex.get("task") if ex.get("ok") else None, "next": []})
    for mod in SOURCES.values():  # a source can also hand over a list of workers (the coding agents), each with a look and a desk
        ex = state["extra"].get(mod.NAME) or {}
        for w in (ex.get("workers") or []) if ex.get("ok") else []:
            issues = [{"level": "warning", "source": w["name"], "message": w["attention"]}] if w.get("attention") else []
            services.append({"name": w["name"], "up": True, "issues": issues, "task": w.get("task") or w.get("attention"), "next": [], "look": w.get("look"), "desk": w.get("desk"), "attention": bool(w.get("attention"))})
    sab = state["sab"]
    if sab.get("queue"):  # downloads by the name they'll have in the library
        sab = {**sab, "queue": [{**q, "name": download_titles.get((q.get("id") or "").lower()) or tidy(q["title"])} for q in sab["queue"]]}
    return json.dumps({
        "title": TITLE, "location": CONFIG.get("location"), "links": LINKS, "now": int(time.time() * 1000), "alerts": issues, "history": {k: list(v) for k, v in history.items()},
        "upcoming": upcoming, **state, "services": services, "sab": sab,
    })


# ---------- sources: one small module per extra service (see sources/README.md) ----------
SOURCES = {}
SECRETS_DIR = os.path.expanduser(CONFIG.get("secrets_dir") or os.path.join(HERE, "secrets"))  # one file per secret, mode 600, never committed


def secret(name):
    """A secret from secrets/<name>, or '' when it isn't there."""
    if not re.fullmatch(r"[a-z0-9_]+", name):
        return ""
    try:
        with open(os.path.join(SECRETS_DIR, name), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def load_sources():
    folder = os.path.join(HERE, "sources")
    off = set(CONFIG.get("sources_off") or [])
    for fn in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
        if not re.fullmatch(r"[a-z0-9_]+\.py", fn) or fn[:-3] in off:
            continue
        spec = importlib.util.spec_from_file_location("source_" + fn[:-3], os.path.join(folder, fn))
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception as e:  # a broken source must not stop the dashboard
            print(f"source {fn}: {type(e).__name__}: {e}", flush=True)
            continue
        mod.ctx = SimpleNamespace(config=(CONFIG.get("sources") or {}).get(mod.NAME, {}), get_json=get_json, secret=secret, sh=sh, proc=proc, state=state)
        SOURCES[mod.NAME] = mod


def run_source(mod):
    """One poll of a source. It runs in its own thread so a poll that hangs (a hostname lookup can ignore every timeout) is abandoned
    after a while and the source is tried again next round, instead of freezing for good."""
    result = {}

    def work():
        try:
            result["value"] = mod.poll(mod.ctx)
        except Exception as e:
            result["error"] = e

    worker = threading.Thread(target=work, daemon=True)
    worker.start()
    worker.join(getattr(mod, "TIMEOUT", 90))
    if worker.is_alive():
        print(f"source {mod.NAME}: no answer, will try again", flush=True)
        state["extra"][mod.NAME] = {"ok": False}
    elif "error" in result:
        print(f"source {mod.NAME}: {type(result['error']).__name__}: {result['error']}", flush=True)
        state["extra"][mod.NAME] = {"ok": False}
    else:
        state["extra"][mod.NAME] = result["value"]


def source_loop(mod):
    while True:
        run_source(mod)
        time.sleep(mod.EVERY)


def start_sources():
    load_sources()
    for mod in SOURCES.values():
        threading.Thread(target=source_loop, args=(mod,), daemon=True).start()


# Where a double-click on an item in the office goes: "open" in each source's config (an address your browser can reach), plus "mediarium_open".
LINKS = {n: c["open"] for n, c in (CONFIG.get("sources") or {}).items() if isinstance(c, dict) and c.get("open")}
if CONFIG.get("mediarium_open"):
    LINKS["mediarium"] = CONFIG["mediarium_open"]


# ---------- login ----------
failures = {}  # ip -> [attempts, locked until]


def private_file(path, make):
    """A value in a file only this user can read, created the first time it's needed."""
    try:
        with open(path, encoding="utf-8") as f:
            value = f.read().strip()
        if value:
            return value
    except OSError:
        pass
    value = make()
    with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as f:
        f.write(value + "\n")
    return value


def password():
    return private_file(PASSWORD_FILE, lambda: secrets.token_urlsafe(12))


def session_token():
    return hmac.new(private_file(SECRET_FILE, lambda: secrets.token_hex(32)).encode(), password().encode(), hashlib.sha256).hexdigest()


class Handler(BaseHTTPRequestHandler):
    def authed(self):
        # No localhost bypass: anything running on this machine (or proxying to it) must log in too.
        cookies = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
        return "dash_auth" in cookies and hmac.compare_digest(cookies["dash_auth"].value, session_token())

    def redirect(self, to, cookie=None):
        self.send_response(303)
        self.send_header("Location", to)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def page(self, name):
        with open(os.path.join(HERE, name), "rb") as f:
            self.reply(200, f.read().replace(b"{{TITLE}}", html.escape(TITLE).encode()), "text/html; charset=utf-8")

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/login":
            return self.page("login.html")
        if path == "/api/data":
            if not self.authed():
                return self.reply(401, b"Login needed", "text/plain")
            return self.reply(200, (demo.payload(TITLE) if DEMO else payload()).encode(), "application/json")
        if DEMO and path.startswith("/demo-poster/"):
            return self.reply(200, demo.poster(path), "image/svg+xml")
        if path in ("/", "/office"):
            return self.page("index.html" if path == "/" else "office.html") if self.authed() else self.redirect("/login")
        if path == "/poster":
            return self.poster() if self.authed() else self.reply(401, b"Login needed", "text/plain")
        if path.startswith("/media/"):
            if not self.authed():
                return self.reply(401, b"Login needed", "text/plain")
            _, _, src, name = (path.split("/", 3) + ["", ""])[:4]
            mod = SOURCES.get(src)
            try:
                got = mod.media(mod.ctx, name, urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)) if mod and hasattr(mod, "media") else None
            except Exception as e:
                print(f"media {src}: {type(e).__name__}", flush=True)
                got = None
            return self.reply(200, got[0], got[1]) if got else self.reply(404, b"Not found", "text/plain")
        if path.startswith("/office_props/"):
            if not self.authed():
                return self.reply(401, b"Login needed", "text/plain")
            folder = os.path.join(HERE, "office_props")
            name = path[len("/office_props/"):]
            if name == "index.json":
                names = sorted(f[:-3] for f in os.listdir(folder) if re.fullmatch(r"[a-z0-9_]+\.js", f)) if os.path.isdir(folder) else []
                return self.reply(200, json.dumps(names).encode(), "application/json")
            if re.fullmatch(r"[a-z0-9_]+\.js", name) and os.path.isfile(os.path.join(folder, name)):
                with open(os.path.join(folder, name), "rb") as f:
                    return self.reply(200, f.read(), "text/javascript; charset=utf-8")
            return self.reply(404, b"Not found", "text/plain")
        if path in VENDOR:
            if not self.authed():
                return self.reply(401, b"Login needed", "text/plain")
            with open(os.path.join(HERE, "vendor", VENDOR[path]), "rb") as f:
                return self.reply(200, f.read(), "text/javascript; charset=utf-8")
        self.reply(404, b"Not found", "text/plain")

    def poster(self):
        """Posters for the office board, fetched here so the 3D page can draw them (the image sites don't allow that directly)."""
        url = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("u", [""])[0]
        if DEMO and url.startswith("/demo-poster/"):
            return self.reply(200, demo.poster(url), "image/svg+xml")
        if not url.startswith(POSTER_HOSTS):
            return self.reply(400, b"Not a poster", "text/plain")
        url = url.replace("/t/p/original/", "/t/p/w500/")
        if url not in poster_cache:
            try:
                with NO_REDIRECT.open(url, timeout=8) as r:
                    poster_cache[url] = (r.read(2_000_000), r.headers.get("Content-Type", "image/jpeg"))
            except OSError:
                return self.reply(502, b"Poster unavailable", "text/plain")
            while len(poster_cache) > 40:
                poster_cache.pop(next(iter(poster_cache)))
        body, ctype = poster_cache[url]
        self.reply(200, body, ctype)

    def do_POST(self):
        if self.path != "/login":
            return self.reply(404, b"Not found", "text/plain")
        ip = self.client_address[0]
        fail = failures.get(ip, [0, 0])
        if fail[1] > time.time():
            return self.redirect("/login?e=locked")
        size = min(int(self.headers.get("Content-Length") or 0), 4096)
        given = urllib.parse.parse_qs(self.rfile.read(size).decode("utf-8", "replace")).get("password", [""])[0]
        if hmac.compare_digest(given.encode(), password().encode()):
            failures.pop(ip, None)
            return self.redirect("/", f"dash_auth={session_token()}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict")
        attempts = 1 if fail[1] else fail[0] + 1  # a finished lockout starts counting again
        failures[ip] = [attempts, time.time() + LOCKOUT if attempts >= MAX_ATTEMPTS else 0]
        time.sleep(0.8)
        self.redirect("/login?e=1")

    def reply(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def serve(host):
    """Listen on one address, retrying until it exists (the Tailscale address isn't there yet right after boot)."""
    while True:
        try:
            server = ThreadingHTTPServer((host, PORT), Handler)
        except OSError as e:
            print(f"cannot listen on {host}:{PORT} yet ({e.strerror}); retrying", flush=True)
            time.sleep(5)
            continue
        print(f"listening on http://{host}:{PORT}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    password()  # made on first run, so it's there to look up
    print(f"{TITLE}{' (demo)' if DEMO else ''}: log in with the password in {PASSWORD_FILE}", flush=True)
    if DEMO:
        import demo
    else:
        read_static()
        threading.Thread(target=system_loop, daemon=True).start()
        load_totals()
        start_sources()
        looped(5, read_mediarium)
        looped(10, read_container)
        looped(30, read_disks)
        looped(30, read_network)
        looped(60, lambda: save_totals())
    for host in BIND[1:]:
        threading.Thread(target=serve, args=(host,), daemon=True).start()
    serve(BIND[0])
