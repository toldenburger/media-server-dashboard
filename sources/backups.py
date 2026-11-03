"""Backups: when each backup job last ran and whether it worked, for the vault.

Reads the systemd user units of the jobs (default: the three Hetzner restic jobs and Time Machine). Override with
"sources": {"backups": {"jobs": [["Label", "unit-name-without-suffix"], ...]}} in config.json.
"""
import time

NAME = "backups"
EVERY = 60
JOBS = [["Immich", "immich-backup-hetzner"], ["iCloud", "icloud-backup-hetzner"], ["SSD", "ssd-backup-hetzner"], ["Time Machine", "time-machine@disk"]]


def show(ctx, unit, *props):
    args = ["/usr/bin/systemctl", "--user", "--timestamp=unix", "show", unit] + [f"-p{p}" for p in props]
    return dict(line.split("=", 1) for line in ctx.sh(*args).splitlines() if "=" in line)


def when(text):
    return int(text.lstrip("@")) if text.lstrip("@").isdigit() else None


def poll(ctx):
    jobs = []
    for label, unit in ctx.config.get("jobs") or JOBS:
        svc = show(ctx, unit + ".service", "Result", "ExecMainStatus", "ExecMainExitTimestamp", "ActiveState")
        tim = show(ctx, unit + ".timer", "NextElapseUSecRealtime", "LastTriggerUSec")
        last = when(svc.get("ExecMainExitTimestamp", "")) or when(tim.get("LastTriggerUSec", ""))
        running = svc.get("ActiveState") in ("activating", "active")
        jobs.append({"name": label, "ok": svc.get("Result") == "success" and svc.get("ExecMainStatus") in ("0", None), "running": running, "last": last, "next": when(tim.get("NextElapseUSecRealtime", ""))})
    done = [j["last"] for j in jobs if j["ok"] and j["last"]]
    return {
        "ok": bool(jobs) and all(j["ok"] for j in jobs), "jobs": jobs, "failed": [j["name"] for j in jobs if not j["ok"]],
        "last_ok": max(done) if done else None, "now": int(time.time()),
    }
