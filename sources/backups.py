"""Backups: when each backup job last ran and whether it worked, for the vault.

Reads the systemd user units of the jobs (default: the three Hetzner restic jobs and Time Machine). Override with
"sources": {"backups": {"jobs": [["Label", "unit-name-without-suffix"], ...]}} in config.json.
"""
import re
import time

NAME = "backups"
EVERY = 60
KEYWORDS = ("backup", "time-machine", "restic", "borg")


def discover(ctx):
    """Every systemd user timer whose name looks like a backup job, as [label, unit]."""
    jobs = []
    for line in ctx.sh("/usr/bin/systemctl", "--user", "list-timers", "--all", "--no-legend", "--no-pager").splitlines():
        unit = next((w[:-6] for w in line.split() if w.endswith(".timer")), "")
        if unit and any(k in unit for k in KEYWORDS):
            jobs.append([re.sub(r"[-_@]+", " ", unit).title()[:22], unit])
    return jobs


def show(ctx, unit, *props):
    args = ["/usr/bin/systemctl", "--user", "--timestamp=unix", "show", unit] + [f"-p{p}" for p in props]
    return dict(line.split("=", 1) for line in ctx.sh(*args).splitlines() if "=" in line)


def when(text):
    return int(text.lstrip("@")) if text.lstrip("@").isdigit() else None


def poll(ctx):
    jobs = []
    for label, unit in ctx.config.get("jobs") or discover(ctx):
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
