"""Docker: how many containers run and whether anything is unhealthy, for the engineer in the server space.

Reads `docker ps -a` only. "recently_changed" is true for five minutes after the set of containers or their
states changes (something started, stopped or restarted), which is when the engineer gets busy.
"""
import time

NAME = "docker"
EVERY = 15
CALM_AFTER = 300
last = {"print": None, "changed": 0.0}


def poll(ctx):
    out = ctx.sh("/usr/bin/docker", "ps", "-a", "--format", "{{.Names}}|{{.State}}|{{.Status}}", timeout=15)
    rows = [line.split("|", 2) for line in out.splitlines() if line.count("|") >= 2]
    if not rows:
        return {"ok": False}
    seen = tuple(sorted((r[0], r[1]) for r in rows))
    if last["print"] is not None and seen != last["print"]:
        last["changed"] = time.time()
    last["print"] = seen
    state = lambda s: [r[0] for r in rows if r[1] == s]
    return {
        "ok": True, "total": len(rows), "running": len(state("running")), "created": len(state("created")), "exited": len(state("exited")),
        "restarting": state("restarting"), "unhealthy": [r[0] for r in rows if "unhealthy" in r[2]],
        "stopped": sorted(state("exited") + state("created"))[:12],
        "recently_changed": time.time() - last["changed"] < CALM_AFTER,
    }
