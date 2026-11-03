"""Spaarpot: the savings pot's wish list, for the piggy bank on the shelf.

Reads its SQLite file read-only. Config:  "sources": {"spaarpot": {"db": "/path/to/spaarpot.db"}}
The amounts only travel to logged-in browsers (hover the piggy bank); the picture shows just how many wishes there are.
"""
import sqlite3

NAME = "spaarpot"
EVERY = 120


def poll(ctx):
    db = ctx.config.get("db")
    if not db:
        raise RuntimeError("sources.spaarpot.db is not set")
    conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=5)
    try:
        rows = conn.execute("select title, amount from items order by id").fetchall()
    finally:
        conn.close()
    return {"ok": True, "count": len(rows), "total": round(sum(r[1] for r in rows), 2), "items": [{"title": r[0], "amount": r[1]} for r in rows][:12]}
