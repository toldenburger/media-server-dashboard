#!/bin/sh
# Stops the dashboard and removes it from login. Your files in this folder are left alone.
UNIT="media_server_dashboard.service"
systemctl --user disable --now "$UNIT" 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/$UNIT"
systemctl --user daemon-reload
echo "Stopped and removed from startup."
