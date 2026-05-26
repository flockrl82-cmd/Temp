#!/bin/bash

# Temporal Mail Automagic Setup Script
# Run this on a fresh Ubuntu server as root: sudo bash setup.sh

echo "=================================="
echo " Temporal Mail - Auto Installer"
echo "=================================="

# 1. Require root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script as root (sudo bash setup.sh)"
  exit 1
fi

echo "✅ Running as root..."

# 2. Install Docker & Dependencies
echo "📦 Installing Docker and dependencies..."
apt-get update -y
apt-get install -y docker.io docker-compose iptables iptables-persistent curl

# 3. Enable and Start Docker
echo "🐳 Starting Docker..."
systemctl enable docker
systemctl start docker

# 4. Route Port 25 (Standard SMTP) down to the Node.js Docker Port 2525
echo "🔀 Rerouting Port 25 traffic to port 2525 inside the container..."
iptables -t nat -A PREROUTING -p tcp --dport 25 -j REDIRECT --to-port 2525
netfilter-persistent save

# 5. Bring up Docker Compose infrastructure (Postgres, Redis, Web Server)
echo "🚀 Building and starting the platform..."
docker-compose up -d --build

echo "=================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=================================="
echo "Your app is now running on port 3000."
echo "Mail server is actively listening on port 25 for incoming emails."
echo ""
echo "Next Steps:"
echo "1. Point your domain's A record to this server's IP."
echo "2. Point your domain's MX record to this server so it receives emails."
echo "3. (Optional) Set up Nginx/Certbot if you want HTTPS."
