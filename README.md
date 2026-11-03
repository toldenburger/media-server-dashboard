# Media Server Dashboard (Linux + Mediarium)

A dashboard and a 3D office for a self-hosted media server. Forked from
[Essq1337/media-server-dashboard](https://github.com/Essq1337/media-server-dashboard) (macOS, Radarr/Sonarr/Prowlarr/Bazarr/SABnzbd)
and ported to Linux, reading everything from [Mediarium](https://github.com/rdborg/Mediarium) instead.

- **Dashboard** (`/`): CPU, memory, network and download graphs, the Mediarium container's own CPU and memory, the download queue,
  drive space, recently added movies and shows, and what's coming up in the next 14 days.
- **Office** (`/office`): Mediarium's jobs sit at their desks as five workers: **Movies, TV, Downloads, Subtitles, Indexers**.
  They work while there is something to do and wander off when idle.

## What changed from upstream

- System stats come from `/proc` instead of macOS tools; a systemd user service replaces launchd.
- One data source: the Mediarium HTTP API (`/api/queue`, `/api/movies`, `/api/series`, `/api/calendar`, `/api/activity`, `/api/indexers`, `/api/health`), read-only (GET only).
  Mediarium reports progress but not speed, so the download speed is worked out from progress between readings.
- Listens only on the addresses in `config.json` `bind` (localhost plus a Tailscale IP). The login applies to localhost too.
- 30-day login cookie; the poster proxy refuses redirects; the Home Cinema integration is gone.

## Setup

1. In Mediarium, make an API key (Profile > API keys) and save it as one line in `mediarium_api_key`, mode 600 (it is in `.gitignore`).
   The key acts as the account that made it, so use an account with only the access you want the dashboard to have.
2. `cp config.example.json config.json` and set `bind` (for tailnet-only: `tailscale ip -4`).
3. `./install.sh` (systemd user service; `./uninstall.sh` removes it). Open `http://<bind address>:8900`;
   the password is in `password.txt`, created on first run.
4. Allow the port for the tailnet only, e.g. `sudo ufw allow in on tailscale0 to any port 8900 proto tcp`.

Try it with made-up data: `python3 server.py --demo` (the demo data still uses the old names and shape).

## Adding more workers

Each worker is a name in `KEYS` in `server.py`, a character in `office.html` (the table with `Movies:`, `TV:`, ...), and a reader that fills
`state[<key>]` and `state["activity"]`. Other self-hosted services can get their own reader the same way.

## Privacy

API keys are read on the server and never sent to the browser. `config.json`, `password.txt`, `.secret`, `mediarium_api_key`,
`stats.json` and logs are in `.gitignore`. The browser loads poster images from TMDB/TheTVDB. Nothing else leaves the machine
except a single ping to 1.1.1.1 every 30 seconds for the "internet" indicator.

## License

MIT, as upstream (see `LICENSE`). three.js r160 is bundled in `vendor/` (MIT).
