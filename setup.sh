#!/bin/bash
set -e

echo "=== Setting up Field Emailer ==="

# Backup Caddyfile first
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
echo "=== Caddyfile backed up ==="

# Only add emailer block if it doesn't already exist
if ! grep -q "emailer.dasgas.com" /etc/caddy/Caddyfile; then
  echo '' >> /etc/caddy/Caddyfile
  echo 'emailer.dasgas.com {' >> /etc/caddy/Caddyfile
  echo '    reverse_proxy localhost:3000' >> /etc/caddy/Caddyfile
  echo '}' >> /etc/caddy/Caddyfile
  echo "=== Caddy config added ==="
else
  echo "=== Caddy config already exists, skipping ==="
fi

# Test caddy config
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
echo "=== Caddy config valid ==="

# Reload caddy
systemctl reload caddy
echo "=== Caddy reloaded ==="

# Kill any existing node process on port 3000
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start the app with nohup so it survives terminal close
cd /opt/emailassist
nohup node server.js > /var/log/emailer.log 2>&1 &
echo "=== App running on port 3000 ==="

echo "=== DONE! Visit https://emailer.dasgas.com ==="
