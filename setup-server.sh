#!/bin/bash
# setup-server.sh — configuration initiale du serveur Hetzner (Ubuntu 22.04)
# À exécuter une seule fois : ssh root@<ip> 'bash -s' < setup-server.sh

set -euo pipefail
DOMAIN="hfp-coach.ch"
EMAIL="robin.staquet@gmail.com"
WEBROOT="/var/www/iobsp-coach"

echo "=== 1. Mise à jour système ==="
apt-get update -q && apt-get upgrade -yq

echo "=== 2. Installation nginx + certbot ==="
apt-get install -yq nginx certbot python3-certbot-nginx

echo "=== 3. Répertoire web ==="
mkdir -p "$WEBROOT"
chown -R www-data:www-data "$WEBROOT"

echo "=== 4. Config nginx temporaire (HTTP) ==="
cat > /etc/nginx/sites-available/iobsp-coach << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $WEBROOT;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
}
NGINXEOF
ln -sf /etc/nginx/sites-available/iobsp-coach /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 5. Certificat Let's Encrypt ==="
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --email "$EMAIL" \
  --redirect

echo "=== 6. Config nginx finale (HTTPS) ==="
# Copier nginx.conf depuis le répertoire web après le premier déploiement
# cp $WEBROOT/nginx.conf /etc/nginx/sites-available/iobsp-coach
# nginx -t && systemctl reload nginx

echo "=== 7. Renouvellement auto Let's Encrypt ==="
systemctl enable certbot.timer

echo ""
echo "✓ Serveur prêt. Maintenant :"
echo "  1. Pointer les DNS : hfp-coach.ch → $(curl -s ifconfig.me)"
echo "  2. Lancer le premier déploiement : ./deploy.sh root@$(curl -s ifconfig.me)"
echo "  3. Copier nginx.conf et recharger : nginx -t && systemctl reload nginx"
