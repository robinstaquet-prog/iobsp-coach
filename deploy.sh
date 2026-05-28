#!/bin/bash
# deploy.sh — déploie iobsp-coach sur Hetzner vers /var/www/iobsp-coach
# Usage : ./deploy.sh <user@host>
# Ex    : ./deploy.sh root@hfp-coach.ch

set -euo pipefail
HOST="${1:-root@hfp-coach.ch}"

echo "→ Déploiement vers $HOST"

# 1. Synchroniser les fichiers (hors fichiers de dev)
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.gitignore' \
  --exclude '.gstack' \
  --exclude 'deploy.sh' \
  --exclude 'nginx.conf' \
  --exclude 'setup-server.sh' \
  . "$HOST:/var/www/iobsp-coach/"

# 2. Recharger nginx (optionnel, pas nécessaire si seuls les fichiers statiques changent)
# ssh "$HOST" "nginx -t && systemctl reload nginx"

echo "✓ Déployé sur https://hfp-coach.ch"

# Déploiement API (si le répertoire api/ est modifié)
deploy_api() {
  echo "→ Déploiement API vers $HOST:/opt/iobsp-coach-api"
  rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.env' \
    --exclude '*.db*' \
    api/ "$HOST:/opt/iobsp-coach-api/"

  ssh "$HOST" "cd /opt/iobsp-coach-api && npm install --omit=dev && systemctl restart iobsp-coach-api"
  echo "✓ API redémarrée"
}

# Décommenter pour déployer l'API :
# deploy_api
