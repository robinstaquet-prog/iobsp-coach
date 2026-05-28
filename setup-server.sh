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

echo "=== 5. Certificats Let's Encrypt (frontend + API) ==="
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --email "$EMAIL" --redirect
certbot --nginx -d "api.$DOMAIN" \
  --non-interactive --agree-tos --email "$EMAIL" --redirect

echo "=== 6. Installation de l'API Node.js ==="
mkdir -p /opt/iobsp-coach-api
# rsync api/ /opt/iobsp-coach-api/ — à faire via deploy.sh
cp "$WEBROOT/api/iobsp-coach-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable iobsp-coach-api
# Démarrer après le premier déploiement : systemctl start iobsp-coach-api

echo "=== 7. Config nginx finale (HTTPS) ==="
cp "$WEBROOT/nginx.conf" /etc/nginx/sites-available/iobsp-coach
nginx -t && systemctl reload nginx

echo "=== 8. Renouvellement auto Let's Encrypt ==="
systemctl enable certbot.timer

echo ""
echo "✓ Serveur prêt. Prochaines étapes :"
echo "  1. DNS pointés : hfp-coach.ch + www + api → $(curl -s ifconfig.me)"
echo "  2. Premier déploiement frontend : ./deploy.sh root@$(curl -s ifconfig.me)"
echo "  3. Premier déploiement API : décommenter deploy_api dans deploy.sh"
echo "  4. Créer /opt/iobsp-coach-api/.env depuis api/.env.example"
echo "  5. systemctl start iobsp-coach-api"
