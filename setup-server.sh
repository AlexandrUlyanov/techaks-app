#!/bin/bash

# ==============================================================================
# INITIAL SERVER SETUP SCRIPT FOR UBUNTU 22.04 / 24.04 / 26.04 (REG.RU FREE TIER)
# ==============================================================================
# Run this on the server as root:
# curl -sSL https://raw.githubusercontent.com/AlexandrUlyanov/techaks-app/master/setup-server.sh | bash
# ==============================================================================

set -e

echo "Starting server setup..."

# 1. Create SWAP File (Critical for 1GB RAM)
if [ ! -f /swapfile ]; then
    echo "Creating 2GB SWAP file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    echo "vm.swappiness=10" >> /etc/sysctl.conf
    sysctl -p
else
    echo "SWAP file already exists."
fi

# 2. Update and Install System Dependencies
echo "Updating system..."
apt-get update
apt-get upgrade -y
apt-get install -y curl wget git nginx mysql-server certbot python3-certbot-nginx build-essential

# 3. Install Node.js & PM2
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# 4. Configure MySQL
echo "Configuring MySQL..."
mysql -e "CREATE DATABASE IF NOT EXISTS techaks_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'techaks'@'localhost' IDENTIFIED BY 'TechAks_DB_Secure123!';"
mysql -e "GRANT ALL PRIVILEGES ON techaks_prod.* TO 'techaks'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 5. Create App Directory
APP_DIR="/var/www/techaks"
if [ ! -d "$APP_DIR" ]; then
    echo "Creating app directory..."
    mkdir -p $APP_DIR
    chown -R root:root $APP_DIR
fi

echo "================================================================"
echo "SERVER SETUP COMPLETE!"
echo "Database: techaks_prod"
echo "DB User: techaks"
echo "DB Pass: TechAks_DB_Secure123!"
echo "App Dir: $APP_DIR"
echo "================================================================"
