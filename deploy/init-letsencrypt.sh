#!/bin/bash
# Bootstraps the backend's TLS cert. Safe to re-run: if a real certificate
# already exists it's left alone (just re-verifies nginx and reloads) -
# this never deletes or force-renews a working cert. Ongoing renewal is
# handled separately by deploy/renew.sh (see README), not by this script.
#
# Standard chicken-and-egg fix: nginx's config references a cert that
# doesn't exist yet, so it won't start; this creates a throwaway dummy
# cert first just so nginx *can* start and serve the ACME HTTP-01
# challenge, then swaps it for the real one.

set -euo pipefail
cd "$(dirname "$0")"

domains=(videoco.ballasgang.shop turn.ballasgang.shop)
cert_name="${domains[0]}"
rsa_key_size=4096
data_path="./certbot"
email="" # set for renewal notices, e.g. "you@example.com"
staging=0 # 1 to test against Let's Encrypt's staging rate limits first

mkdir -p "$data_path/conf" "$data_path/www"

# The TLS parameter files used to be fetched from GitHub raw URLs - those
# paths have moved/404 now. They ship inside the certbot image itself.
if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparam.pem" ]; then
  echo "### Fetching recommended TLS parameters from the certbot image ..."
  docker compose run --rm --entrypoint sh certbot -c '
    cp /opt/certbot/src/certbot/src/certbot/_internal/plugins/nginx/tls_configs/options-ssl-nginx.conf /etc/letsencrypt/options-ssl-nginx.conf &&
    cp /opt/certbot/src/certbot/src/certbot/ssl-dhparams.pem /etc/letsencrypt/ssl-dhparam.pem
  '
fi

if [ -e "$data_path/conf/live/$cert_name/fullchain.pem" ]; then
  echo "### Real certificate for $cert_name already exists - leaving it alone."
  echo "### (to force a fresh bootstrap, remove $data_path/conf/live/$cert_name first)"
  docker compose up -d nginx
  docker compose exec nginx nginx -t
  docker compose exec nginx nginx -s reload
  echo "### Done - nginx verified and reloaded against the existing certificate."
  exit 0
fi

echo "### No real certificate found - creating a dummy one so nginx can start ..."
docker compose run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$cert_name &&
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
    -keyout /etc/letsencrypt/live/$cert_name/privkey.pem \
    -out /etc/letsencrypt/live/$cert_name/fullchain.pem \
    -subj '/CN=localhost'
"

echo "### Starting nginx ..."
docker compose up -d nginx
sleep 3

if ! docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
  echo "### nginx failed to start with the dummy cert - aborting before touching anything else." >&2
  docker compose logs nginx
  exit 1
fi

echo "### nginx is up. Deleting the dummy certificate for $cert_name ..."
docker compose run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$cert_name \
         /etc/letsencrypt/archive/$cert_name \
         /etc/letsencrypt/renewal/$cert_name.conf
"

echo "### Requesting real certificate for: ${domains[*]} ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

email_arg="--register-unsafely-without-email"
if [ -n "$email" ]; then
  email_arg="--email $email"
fi

staging_arg=""
if [ "$staging" != "0" ]; then
  staging_arg="--staging"
fi

if ! docker compose run --rm --entrypoint sh certbot -c "
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg $email_arg $domain_args \
    --rsa-key-size $rsa_key_size --agree-tos --non-interactive
"; then
  echo "### Certificate request FAILED. nginx is still running on the dummy cert" >&2
  echo "### (HTTPS will show a cert warning) - check the certbot output above," >&2
  echo "### fix the issue (usually DNS not resolving here yet), and re-run this script." >&2
  exit 1
fi

if [ ! -e "$data_path/conf/live/$cert_name/fullchain.pem" ]; then
  echo "### certbot reported success but the certificate file is still missing - investigate before continuing." >&2
  exit 1
fi

echo "### Verifying nginx config and reloading with the real certificate ..."
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload

echo "### Done. Verify with: curl -I https://$cert_name"
