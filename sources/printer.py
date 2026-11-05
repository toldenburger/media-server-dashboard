"""Printer: ink, paper, jobs and page counts, for the big copier.

Asks the printer over IPP with `ipptool` (part of CUPS) and CUPS's own queue, read-only: the printer for the real ink levels, state and
paper, CUPS for the job list. For HP printers it also reads the printer's own usage page (total pages and jams). Config:
  "sources": {"printer": {"queue": "your_cups_queue", "host": "<the printer's address on your network>", "open": "http://localhost:631/printers/your_cups_queue"}}
`host` is the printer's address on your network (optional: without it, or when it does not answer, CUPS's own view is used, which for some printers
leaves a cartridge's level unknown). `queue` is the CUPS queue name.
"""
import os
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

NAME = "printer"
EVERY = 5
TIMEOUT = 25
ATTR = re.compile(r"^\s+(\S+) \(([^)]*)\) = (.*)$")
usage_cache = {"at": 0.0, "data": {}}

PRINTER_TEST = """{
	NAME "Get printer attributes"
	OPERATION Get-Printer-Attributes
	GROUP operation-attributes-tag
	ATTR charset attributes-charset utf-8
	ATTR language attributes-natural-language en
	ATTR uri printer-uri $uri
	ATTR keyword requested-attributes printer-name,printer-info,printer-state,printer-state-reasons,printer-state-message,printer-up-time,queued-job-count,marker-names,marker-levels,marker-colors,marker-low-levels,marker-types,media-ready,printer-make-and-model
}
"""
JOBS_TEST = """{
	NAME "Get jobs"
	OPERATION Get-Jobs
	GROUP operation-attributes-tag
	ATTR charset attributes-charset utf-8
	ATTR language attributes-natural-language en
	ATTR uri printer-uri $uri
	ATTR keyword which-jobs $which
	ATTR integer limit 30
	ATTR keyword requested-attributes job-id,job-state,job-state-reasons,job-media-sheets-completed,job-impressions-completed,job-impressions,time-at-creation,time-at-completed,time-at-processing,job-k-octets
}
"""
tests = {}


def test_file(name, text):
    """ipptool wants test files on disk; write each once to this process's private temp folder."""
    if name not in tests or not os.path.exists(tests[name]):
        d = tempfile.mkdtemp(prefix="printer_ipp_")
        tests[name] = os.path.join(d, name + ".test")
        with open(tests[name], "w") as f:
            f.write(text)
    return tests[name]


def ipp(ctx, uri, name, text, defines=(), timeout=8):
    """Run an IPP test and return the attribute groups of the answer: a list of {attribute: value} dicts."""
    args = ["/usr/bin/ipptool", "-tv"]
    for d in defines:
        args += ["-d", d]
    out = ctx.sh(*args, uri, test_file(name, text), timeout=timeout)
    if "status-code = successful-ok" not in out:
        return None
    groups, cur = [], {}
    body = out.split("status-code = ", 1)[1].split("\n", 1)[1]
    for line in body.splitlines():
        if "-- separator --" in line:
            groups.append(cur)
            cur = {}
            continue
        m = ATTR.match(line)
        if m:
            cur[m.group(1)] = m.group(3)
    groups.append(cur)
    return [g for g in groups if g]


def numbers(value):
    return [int(x) for x in re.findall(r"-?\d+", value or "")]


def names(value):
    return [x.strip() for x in (value or "").split(",")]


def hp_usage(host):
    """HP printers keep their own page counter and jam count on a small web page; cached for ten minutes."""
    import time
    if time.time() - usage_cache["at"] < 600 and usage_cache["data"]:
        return usage_cache["data"]
    out = {}
    try:
        with urllib.request.urlopen(f"http://{host}/DevMgmt/ProductUsageDyn.xml", timeout=5) as r:
            root = ET.fromstring(r.read(200_000))
        for el in root.iter():
            tag = el.tag.split("}")[-1]
            if tag == "TotalImpressions" and "pages_total" not in out:  # the first one is the printer's grand total
                out["pages_total"] = int(el.text)
            elif tag == "JamEvents" and "jams" not in out:
                out["jams"] = int(el.text)
    except Exception:
        pass
    usage_cache.update(at=time.time(), data=out or usage_cache["data"])
    return usage_cache["data"]


def poll(ctx):
    cfg = ctx.config
    queue = cfg.get("queue")
    if not queue:
        raise RuntimeError("sources.printer.queue is not set")
    local = f"ipp://localhost/printers/{queue}"
    host = cfg.get("host")
    direct = ipp(ctx, f"ipp://{host}/ipp/print", "printer", PRINTER_TEST, timeout=6) if host else None
    cups = ipp(ctx, local, "printer", PRINTER_TEST)
    if not cups and not direct:
        return {"ok": False}
    p = (direct or cups)[0]
    c = (cups or [{}])[0]
    state = {"idle": "idle", "processing": "printing", "stopped": "stopped"}.get(p.get("printer-state"), p.get("printer-state") or "idle")
    reasons = [r for r in names(p.get("printer-state-reasons")) if r and r != "none"]

    # ink: from the printer itself when it answered, otherwise from CUPS; a negative level means "not reported"
    levels, mnames, colors = numbers(p.get("marker-levels")), names(p.get("marker-names")), names(p.get("marker-colors"))
    cups_levels = numbers(c.get("marker-levels"))
    ink = []
    for i, n in enumerate(mnames):
        level = levels[i] if i < len(levels) else -1
        if level < 0 and i < len(cups_levels):
            level = cups_levels[i]
        ink.append({"name": n, "level": level if level >= 0 else None, "black": "black" in n.lower() and "tri" not in n.lower(),
                    "low": level >= 0 and level <= 20})

    # jobs from CUPS: what is queued or printing, and how many pages went out today
    active = [j for j in ipp(ctx, local, "jobs", JOBS_TEST, ["which=not-completed"]) or [] if "job-id" in j]
    done = [j for j in ipp(ctx, local, "jobs", JOBS_TEST, ["which=completed"]) or [] if "job-id" in j]
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    today = sum((numbers(j.get("job-media-sheets-completed")) or [0])[0] for j in done if (numbers(j.get("time-at-completed")) or [0])[0] >= midnight)
    jobs = []
    for j in active:
        jobs.append({
            "id": (numbers(j.get("job-id")) or [0])[0], "state": j.get("job-state"), "pages_done": (numbers(j.get("job-media-sheets-completed")) or [0])[0],
            "pages": (numbers(j.get("job-impressions")) or [0])[0] or None, "since": (numbers(j.get("time-at-processing")) or [0])[0] or None,
            "created": (numbers(j.get("time-at-creation")) or [0])[0] or None,
        })
    printing = next((j for j in jobs if j["state"] in ("processing", "processing-stopped")), None)
    if printing and state == "idle":
        state = "printing"
    usage = hp_usage(host) if host else {}
    reasons_text = " ".join(reasons)
    return {
        "ok": True, "name": re.sub(r"\s*\\?\[[^\]]*\]", "", p.get("printer-info") or queue), "state": state, "reasons": reasons, "message": c.get("printer-state-message"),
        "paper_out": "media-empty" in reasons_text or "media-needed" in reasons_text, "jam": "media-jam" in reasons_text,
        "cover_open": "cover-open" in reasons_text or "door-open" in reasons_text, "ink": ink,
        "ink_low": any(i["low"] for i in ink), "queued": len(jobs), "printing": printing, "jobs": jobs[:6],
        "pages_today": today, "pages_total": usage.get("pages_total"), "jams": usage.get("jams"),
        "paper": [m for m in names(p.get("media-ready")) if m][:4],
    }
