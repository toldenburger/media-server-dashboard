"""AI coding agents: one office worker per active Claude Code session and per running OpenCode instance.

Reads local files only (read-only, no login):
  - Claude Code: the status file every running session keeps in ~/.claude/sessions (its name, whether it is busy or idle, and when it
    waits for you, for example for an approval). A session shows up while busy, waiting, or changed in the last 45 minutes.
  - OpenCode: running opencode processes (their working folder names the project, or, where a folder cannot be read, the most recently used
    project in its database) and whether a session there changed in the last 25 seconds.
The source hands the server a list of "workers" (see sources/README.md), with "attention" set when the agent needs you; the first few get a desk along the back wall and keep it while they live.
Config: "sources": {"agents": {"slots": 3}}  (how many agents are shown at once; the office has that many desks, up to 3).
"""
import json
import os
import sqlite3
import time

NAME = "agents"
EVERY = 6
SHOW_FOR = 45 * 60
WORKING = 25
NEEDS_YOU = {"waiting", "blocked", "needs_approval", "needs-approval", "needs-auth", "needs_sign_in"}  # Claude Code states that wait for you
HOME = os.path.expanduser("~")
slots = {}      # agent id -> desk slot, kept while the agent lives
OPENCODE_DB = os.path.join(HOME, ".local/share/opencode/opencode.db")


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


def opencode_instances(now):
    procs = opencode_processes()
    if not procs:
        return []
    try:
        db = sqlite3.connect(f"file:{OPENCODE_DB}?mode=ro", uri=True, timeout=3)
    except sqlite3.Error:
        db = None
    recent = {}  # folder -> age of its newest session, newest first
    if db:
        try:
            for folder, updated in db.execute("select directory, max(time_updated) from session group by directory order by 2 desc limit 12"):
                recent[folder] = now - (updated or 0) / 1000
        except sqlite3.Error:
            pass
    folders = [f for f in procs if f]
    if len(folders) < len(procs):  # some folders unreadable: name those instances after the most recently used projects
        spare = [f for f in recent if f not in folders and f not in ("/", HOME)] + [None] * len(procs)
        folders += spare[: len(procs) - len(folders)]
    out = []
    for i, folder in enumerate(folders):
        age = recent.get(folder, 10 ** 9)
        out.append({"id": "opencode:" + (folder or str(i)), "look": "opencode", "project": project_name(folder) if folder else "session", "working": age < WORKING, "attention": None, "age": age})
    if db:
        db.close()
    return out


def poll(ctx):
    now = time.time()
    count = int(ctx.config.get("slots") or 3)
    agents = claude_sessions(now) + opencode_instances(now)
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
