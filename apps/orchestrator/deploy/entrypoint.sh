#!/usr/bin/env bash
set -euo pipefail

# Hosts + upstreams (overridable via env; sensible compose defaults).
: "${APP_HOST:?APP_HOST required}"
: "${API_HOST:?API_HOST required}"
: "${LE_EMAIL:?LE_EMAIL required}"
: "${BACKEND_UPSTREAM:=http://backend:8000}"
: "${KRATOS_PUBLIC_UPSTREAM:=http://kratos:4433}"

export APP_HOST API_HOST BACKEND_UPSTREAM KRATOS_PUBLIC_UPSTREAM

mkdir -p /var/www/certbot
LIVE="/etc/letsencrypt/live/${APP_HOST}"

# Render nginx config (only our vars; leave nginx's own $vars intact).
envsubst '${APP_HOST} ${API_HOST} ${KRATOS_PUBLIC_UPSTREAM} ${BACKEND_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

issue_self_signed() {
  echo "==> issuing self-signed fallback cert for ${APP_HOST}, ${API_HOST}"
  mkdir -p "${LIVE}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "${LIVE}/privkey.pem" -out "${LIVE}/fullchain.pem" \
    -subj "/CN=${APP_HOST}" \
    -addext "subjectAltName=DNS:${APP_HOST},DNS:${API_HOST}"
}

if [ ! -f "${LIVE}/fullchain.pem" ]; then
  echo "==> requesting Let's Encrypt cert (standalone http-01) for ${APP_HOST}, ${API_HOST}"
  if certbot certonly --standalone --non-interactive --agree-tos \
      -m "${LE_EMAIL}" -d "${APP_HOST}" -d "${API_HOST}"; then
    echo "==> certbot succeeded"
  else
    echo "==> certbot failed (DNS not propagated / rate limit) — falling back to self-signed"
    issue_self_signed
  fi
fi

exec nginx -g 'daemon off;'
