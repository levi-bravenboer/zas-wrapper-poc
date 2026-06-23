#!/usr/bin/env bash
set -euo pipefail

# Hosts + upstreams (overridable via env; sensible compose defaults).
: "${APP_HOST:?APP_HOST required}"
: "${API_HOST:?API_HOST required}"
: "${FILES_HOST:?FILES_HOST required}"
: "${LE_EMAIL:?LE_EMAIL required}"
: "${BACKEND_UPSTREAM:=http://backend:8000}"
: "${KRATOS_PUBLIC_UPSTREAM:=http://kratos:4433}"
: "${MINIO_UPSTREAM:=http://minio:9000}"

export APP_HOST API_HOST FILES_HOST BACKEND_UPSTREAM KRATOS_PUBLIC_UPSTREAM MINIO_UPSTREAM

mkdir -p /var/www/certbot
LIVE="/etc/letsencrypt/live/${APP_HOST}"

# Render nginx config (only our vars; leave nginx's own $vars intact).
envsubst '${APP_HOST} ${API_HOST} ${FILES_HOST} ${KRATOS_PUBLIC_UPSTREAM} ${BACKEND_UPSTREAM} ${MINIO_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

issue_self_signed() {
  echo "==> issuing self-signed fallback cert for ${APP_HOST}, ${API_HOST}, ${FILES_HOST}"
  mkdir -p "${LIVE}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "${LIVE}/privkey.pem" -out "${LIVE}/fullchain.pem" \
    -subj "/CN=${APP_HOST}" \
    -addext "subjectAltName=DNS:${APP_HOST},DNS:${API_HOST},DNS:${FILES_HOST}"
}

# Idempotent: --keep-until-expiring skips when valid; --expand adds new domains
# (e.g. files host) to an existing cert without a fresh issuance.
echo "==> Let's Encrypt cert (standalone http-01) for ${APP_HOST}, ${API_HOST}, ${FILES_HOST}"
if certbot certonly --standalone --non-interactive --agree-tos --keep-until-expiring --expand \
    -m "${LE_EMAIL}" -d "${APP_HOST}" -d "${API_HOST}" -d "${FILES_HOST}"; then
  echo "==> certbot ok"
elif [ ! -f "${LIVE}/fullchain.pem" ]; then
  echo "==> certbot failed and no cert present — self-signed fallback"
  issue_self_signed
fi

exec nginx -g 'daemon off;'
