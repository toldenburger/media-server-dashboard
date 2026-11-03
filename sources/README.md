# Sources

One small Python file per extra service. The server loads every `sources/<name>.py` at start-up (skip one with
`"sources_off": ["name"]` in `config.json`) and polls it on its own thread. What `poll()` returns shows up in the
dashboard data as `extra.<NAME>`, and the matching office prop (`office_props/<name>.js`) draws it.

A source module defines:

| name | what |
|---|---|
| `NAME` | short lowercase id, also the key in `extra` |
| `EVERY` | seconds between polls |
| `poll(ctx)` | returns a JSON-friendly dict (include `"ok": true`); may raise, the server marks it down |
| `TIMEOUT` | optional: seconds before a poll that has not answered is abandoned and retried next round (default 90) |
| `SERVICE` | optional: a name; the source then also gets a worker at a desk, busy while `poll()` returns a `"task"` |
| `media(ctx, name, query)` | optional: bytes and content type for `/media/<NAME>/<name>`, for images and audio the browser can't fetch itself. Validate `name` and `query` strictly. |

`ctx` gives you `config` (the `sources.<NAME>` block of `config.json`), `get_json(url, headers, timeout)`, `secret(name)`
(reads `secrets/<name>`, mode 600, never committed), `sh(...)` and `proc(path)`.

Rules: read-only requests only, one secret file per credential, and nothing in `poll()` that can write to the service.
