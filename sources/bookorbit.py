"""BookOrbit: the newest books, for the bookshelf.

Reads BookOrbit's own database (read-only SELECT) through `docker exec` in its database container, so no password is needed. Config:
  "sources": {"bookorbit": {"container": "bookorbit-db"}}   (the container's POSTGRES_USER and POSTGRES_DB are used)
"""
import subprocess

NAME = "bookorbit"
EVERY = 120
SQL = """
select coalesce(m.title, '?'), coalesce(b.primary_author_sort_name, ''), to_char(b.added_at, 'YYYY-MM-DD"T"HH24:MI:SS'), (select count(*) from books)
from books b left join book_metadata m on m.book_id = b.id
order by b.added_at desc limit 6;
"""


def poll(ctx):
    container = ctx.config.get("container") or "bookorbit-db"
    out = subprocess.run(["docker", "exec", "-i", container, "sh", "-c", 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -At -F "|"'], input=SQL, capture_output=True, text=True, timeout=30)
    rows = [line.split("|") for line in out.stdout.splitlines() if line.count("|") >= 3]
    if out.returncode or not rows:
        return {"ok": False}
    return {"ok": True, "total": int(rows[0][3]), "latest": [{"title": r[0], "author": r[1], "added": r[2]} for r in rows]}
