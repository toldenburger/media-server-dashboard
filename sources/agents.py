"""AI coding agents: one office worker per active Claude Code session and per running OpenCode instance.

Reads local files only (read-only, no login):
  - Claude Code: the status file every running session keeps in ~/.claude/sessions (its name, whether it is busy or idle, and when it
    waits for you, for example for an approval). A session shows up while busy, waiting, or changed in the last 45 minutes.
  - OpenCode: running opencode processes (their working folder names the project, or, where a folder cannot be read, the most recently used
    project in its database) and whether a session there changed in the last 25 seconds.
The source hands the server a list of "workers" (see sources/README.md), with "attention" set when the agent needs you; the first few get a desk along the back wall and keep it while they live.
Config: "sources": {"agents": {"slots": 3, "opencode_api": true}}  (how many agents are shown at once, up to the 3 desks; and whether to ask
OpenCode's own local server whether a session is working or waits for an approval or question.)

OpenCode's local server needs the password OpenCode keeps in ~/.local/state/opencode/service.json. It is read again on every poll, held only in
memory and sent only to a loopback address, and only GET requests are made. That password can control OpenCode, so set "opencode_api": false if
you would rather not give the dashboard that access (agents then show only as present, and as working while their session changed in the last
25 seconds).
"""
import base64
import json
import os
import re
import sqlite3
import time
import urllib.request

NAME = "agents"
EVERY = 6
SHOW_FOR = 45 * 60
WORKING = 25
NEEDS_YOU = {"waiting", "blocked", "needs_approval", "needs-approval", "needs-auth", "needs_sign_in"}  # Claude Code states that wait for you
HOME = os.path.expanduser("~")
slots = {}      # agent id -> desk slot, kept while the agent lives
OPENCODE_DB = os.path.join(HOME, ".local/share/opencode/opencode.db")
OPENCODE_SERVICE = os.path.join(HOME, ".local/state/opencode/service.json")


def project_name(folder):
    return "home" if not folder or os.path.realpath(folder) == os.path.realpath(HOME) else os.path.basename(folder.rstrip("/")) or "home"


def claude_sessions(now):
    """Live Claude Code processes, from the status file each one keeps in ~/.claude/sessions."""
    found = []
    try:
        files = [f for f in os.scandir(os.path.join(HOME, ".claude/sessions")) if f.name.endswith(".json")]
    except OSError:
        return found
    for f in files:
        try:
            with open(f.path, encoding="utf-8") as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            continue
        if not d.get("sessionId") or not d.get("pid") or not os.path.exists(f"/proc/{d['pid']}"):
            continue  # the process has ended
        status, waiting = d.get("status"), d.get("waitingFor")
        attention = bool(waiting) or status in NEEDS_YOU
        age = now - (d.get("statusUpdatedAt") or d.get("updatedAt") or 0) / 1000
        if not (status == "busy" or attention or age < SHOW_FOR):
            continue  # idle for a long time: not worth a desk
        found.append({
            "id": "claude:" + d["sessionId"], "look": "claude", "project": d.get("name") or project_name(d.get("cwd")),
            "working": status == "busy", "attention": ("Needs you: " + str(waiting or status).replace("_", " ").replace("-", " "))[:60] if attention else None, "age": age,
        })
    return found


def opencode_processes():
    """Folders of the running OpenCode programs; a folder is None when it cannot be read (inside the service's sandbox only the existence of the
    process is visible)."""
    found = []
    for pid in (p for p in os.listdir("/proc") if p.isdigit()):
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as fh:
                args = fh.read().decode("utf-8", "replace").split("\0")
        except OSError:
            continue
        if not (os.path.basename(args[0]) == "opencode" or any("@opencode+cli" in a for a in args)):
            continue
        try:
            found.append(os.readlink(f"/proc/{pid}/cwd"))
        except OSError:
            found.append(None)
    return found


def opencode_api(path):
    """GET from OpenCode's own local server (the address and password it keeps in ~/.local/state/opencode/service.json, read again on every call
    and only ever sent to a loopback address). Returns the data, or None when it is not available."""
    try:
        with open(OPENCODE_SERVICE, encoding="utf-8") as fh:
            svc = json.load(fh)
        if not re.match(r"http://(127\.0\.0\.1|localhost|\[::1\]):\d+$", svc["url"]):
            return None
        auth = base64.b64encode(b"opencode:" + svc["password"].encode()).decode()
        with urllib.request.urlopen(urllib.request.Request(svc["url"] + path, headers={"Authorization": "Basic " + auth}), timeout=4) as r:
            return json.load(r).get("data")
    except (OSError, ValueError, KeyError):
        return None


def opencode_recent(now, use_api):
    """The newest OpenCode session per project folder, newest first: {folder, age, idle, id}. From its local API when allowed; otherwise from its
    database (the current session_v2 table), where whether a session is idle is not known."""
    data = opencode_api("/api/session?limit=12") if use_api else None
    out, seen = [], set()
    if isinstance(data, list):
        for sess in data:
            folder, t = (sess.get("location") or {}).get("directory"), sess.get("time") or {}
            if folder and sess.get("id") and folder not in seen:
                seen.add(folder)
                out.append({"folder": folder, "age": now - (t.get("updated") or 0) / 1000, "idle": "idle" in t, "id": sess["id"]})
        return out
    try:
        db = sqlite3.connect(f"file:{OPENCODE_DB}?mode=ro", uri=True, timeout=3)
        try:
            for folder, updated in db.execute("select directory, max(time_updated) from session_v2 group by directory order by 2 desc limit 12"):
                out.append({"folder": folder, "age": now - (updated or 0) / 1000, "idle": None, "id": None})
        finally:
            db.close()
    except sqlite3.Error:
        pass
    return out


def opencode_attention(session_id):
    """A pending approval or question in an OpenCode session, from its local API (a session that is not loaded answers 404, meaning no information)."""
    perm = opencode_api(f"/api/session/{session_id}/permission")
    if perm:
        return "approval: " + str((perm[0] or {}).get("action", "?"))[:24]
    form = opencode_api(f"/api/session/{session_id}/form")
    if form:
        return "question"
    return None


def opencode_instances(now, use_api=True):
    procs = opencode_processes()
    if not procs:
        return []
    recent = opencode_recent(now, use_api)
    by_folder = {r["folder"]: r for r in recent}
    folders = [f for f in procs if f]
    if len(folders) < len(procs):  # some folders unreadable: name those instances after the most recently used projects
        spare = [r["folder"] for r in recent if r["folder"] not in folders and r["folder"] not in ("/", HOME)] + [None] * len(procs)
        folders += spare[: len(procs) - len(folders)]
    out = []
    for i, folder in enumerate(folders):
        rec = by_folder.get(folder)
        working = bool(rec and (rec["idle"] is False or (rec["idle"] is None and rec["age"] < WORKING)))
        note = opencode_attention(rec["id"]) if rec and rec["id"] and rec["idle"] is False else None
        out.append({
            "id": "opencode:" + (folder or str(i)), "look": "opencode", "project": project_name(folder) if folder else "session", "working": working,
            "attention": "Needs you: " + note if note else None, "age": rec["age"] if rec else 10 ** 9,
        })
    return out


def poll(ctx):
    now = time.time()
    count = int(ctx.config.get("slots") or 3)
    agents = claude_sessions(now) + opencode_instances(now, ctx.config.get("opencode_api", True))
    agents.sort(key=lambda a: (not a["attention"], not a["working"], a["age"]))
    shown = agents[:count]
    ids = {a["id"] for a in shown}
    for gone in [i for i in slots if i not in ids]:
        del slots[gone]
    taken = set(slots.values())
    for a in shown:
        if a["id"] not in slots:
            slots[a["id"]] = next(s for s in range(count) if s not in taken)
            taken.add(slots[a["id"]])
    workers, used = [], {}
    for a in shown:
        label = "Claude" if a["look"] == "claude" else "OpenCode"
        base = f"{label}: {a['project']}"[:26]
        used[base] = used.get(base, 0) + 1
        workers.append({
            "name": base if used[base] == 1 else f"{base} {used[base]}", "look": a["look"], "desk": slots[a["id"]],
            "task": f"Working in {a['project']}" if a["working"] else None, "attention": a["attention"],
        })
    return {"ok": True, "workers": workers, "claude": sum(1 for a in agents if a["look"] == "claude"), "opencode": sum(1 for a in agents if a["look"] == "opencode")}
