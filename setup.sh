#!/bin/bash
set -e

echo "=== Setting up Field Emailer ==="

# Copy nginx config
cp /opt/emailassist/nginx.conf /etc/nginx/sites-available/emailer
ln -sf /etc/nginx/sites-available/emailer /etc/nginx/sites-enabled/emailer

# Test nginx
nginx -t

# Reload nginx
systemctl reload nginx
echo "=== Nginx configured ==="

# SSL cert
certbot --nginx -d emailer.dasgas.com --non-interactive --agree-tos -m jviruet83@gmail.com
echo "=== SSL configured ==="

# Kill any existing node process on port 3000
fuser -k 3000/tcp 2>/dev/null || true

# Start the app with nohup so it survives terminal close
cd /opt/emailassist
nohup node server.js > /var/log/emailer.log 2>&1 &
echo "=== App running on port 3000 ==="

echo "=== DONE! Visit https://emailer.dasgas.com ==="
