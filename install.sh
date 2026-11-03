#!/bin/sh
# Starts the dashboard now and at every login (a systemd user service, your user only).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
UNIT="media_server_dashboard.service"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/$UNIT" <<UNIT
[Unit]
Description=Media server dashboard and 3D office
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 -I $DIR/server.py
WorkingDirectory=$DIR
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$DIR

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now "$UNIT"
sleep 2
systemctl --user --no-pager status "$UNIT" | head -8
echo "Log in with the password in $DIR/password.txt"
