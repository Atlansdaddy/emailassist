#!/bin/bash
set -e

# Field Emailer deploy script.
# Idempotent: safe to re-run after pulling new code.
# Requires sudo (installs/refreshes a systemd unit and reloads Caddy).

if [ "$EUID" -ne 0 ]; then
  echo "Re-running under sudo..."
  exec sudo -E "$0" "$@"
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
UNIT_SRC="$REPO_DIR/emailer.service"
UNIT_DST="/etc/systemd/system/emailer.service"
LOG_FILE="/var/log/emailer.log"
APP_USER="dasadmin"

echo "=== Setting up Field Emailer ==="

# --- Caddy reverse proxy ---
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
echo "=== Caddyfile backed up ==="

if ! grep -q "emailer.dasgas.com" /etc/caddy/Caddyfile; then
  cat >> /etc/caddy/Caddyfile <<'CADDY'

emailer.dasgas.com {
    reverse_proxy localhost:3000
}
CADDY
  echo "=== Caddy config added ==="
else
  echo "=== Caddy config already exists, skipping ==="
fi

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
echo "=== Caddy config valid ==="
systemctl reload caddy
echo "=== Caddy reloaded ==="

# --- Log file ---
touch "$LOG_FILE"
chown "$APP_USER:$APP_USER" "$LOG_FILE"

# --- systemd unit ---
# Install or refresh the unit only if it differs from the in-repo copy.
if ! cmp -s "$UNIT_SRC" "$UNIT_DST"; then
  install -m 644 "$UNIT_SRC" "$UNIT_DST"
  systemctl daemon-reload
  echo "=== emailer.service installed/updated ==="
else
  echo "=== emailer.service unchanged ==="
fi

systemctl enable emailer.service >/dev/null
systemctl restart emailer.service

sleep 2
if systemctl is-active --quiet emailer.service; then
  echo "=== emailer.service is active ==="
else
  echo "!!! emailer.service failed to start; see: journalctl -u emailer -n 50"
  exit 1
fi

echo "=== DONE! Visit https://emailer.dasgas.com ==="
