#!/bin/bash
# One-shot setup script for Deal Engine
# Run: curl -sSL <url> | bash  OR  bash setup.sh

set -e

echo "========================================="
echo "  Deal Engine - Full Setup Script"
echo "========================================="

cd /opt/deal-engine || { echo "Repo not found, cloning..."; git clone https://github.com/Mayankx13/Hello-world.git /opt/deal-engine && cd /opt/deal-engine; }

# Pull latest code
git fetch origin claude/whatsapp-real-estate-deals-TiX7F
git checkout claude/whatsapp-real-estate-deals-TiX7F
git reset --hard origin/claude/whatsapp-real-estate-deals-TiX7F

# Kill ALL docker containers and clean up
echo "Cleaning Docker..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker network prune -f 2>/dev/null || true

# Clear stale WhatsApp auth (clear files, not the directory)
echo "Clearing stale WhatsApp auth..."
mkdir -p /opt/deal-engine/auth_info_baileys
rm -f /opt/deal-engine/auth_info_baileys/* 2>/dev/null || true

# Build and start
echo "Building and starting containers..."
cd /opt/deal-engine
docker compose up -d --build

# Wait for DB to be healthy
echo "Waiting for database..."
for i in $(seq 1 30); do
  if docker compose exec db pg_isready -U dealengine 2>/dev/null; then
    echo "Database ready!"
    break
  fi
  echo "  waiting... ($i/30)"
  sleep 2
done

# Stop the main app (we need port 3000 free and auth fresh)
echo "Stopping app container for QR auth..."
docker compose stop app

# Verify DB is running
echo ""
echo "Container status:"
docker compose ps
echo ""

# Now run the QR auth script (no --rm so auth files persist in volume)
echo "========================================="
echo "  Starting QR Code Server on port 3001"
echo "========================================="
echo ""
echo "  Open this in your browser NOW:"
echo ""
echo "  http://157.245.101.144:3001"
echo ""
echo "  Then scan the QR with WhatsApp:"
echo "  Settings > Linked Devices > Link a Device"
echo ""
echo "  After scanning, press Ctrl+C and run:"
echo "  docker compose up -d"
echo ""
echo "========================================="

docker compose run -p 3001:3001 app node /app/src/whatsapp/qr-auth.js
