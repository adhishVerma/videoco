#!/bin/bash
# Checks for certificate renewal and only reloads nginx / restarts coturn
# when a renewal actually happened - `certbot renew` itself is a safe
# no-op until a cert is within 30 days of expiry, but nginx/coturn still
# need to be told to pick up a new cert file when one does land.
#
# Runs on the host (not inside a container), so it needs no Docker socket
# access from certbot itself - just cron calling this script. See README
# for the crontab line.

set -euo pipefail
cd "$(dirname "$0")"

marker="./certbot/conf/.last-renewed"

before=""
if [ -f "$marker" ]; then
  before=$(stat -c %Y "$marker" 2>/dev/null || stat -f %m "$marker" 2>/dev/null)
fi

docker compose run --rm --entrypoint sh certbot -c \
  "certbot renew --webroot -w /var/www/certbot --deploy-hook 'touch /etc/letsencrypt/.last-renewed'"

after=""
if [ -f "$marker" ]; then
  after=$(stat -c %Y "$marker" 2>/dev/null || stat -f %m "$marker" 2>/dev/null)
fi

if [ -n "$after" ] && [ "$after" != "$before" ]; then
  echo "$(date): certificate renewed - reloading nginx and restarting coturn"
  docker compose exec -T nginx nginx -s reload
  # coturn reads its cert once at startup and doesn't watch the file for
  # changes, so it needs a restart (not just a reload) to pick up a
  # renewed cert. This briefly drops any calls mid-relay through it -
  # acceptable since it only happens roughly every 60 days.
  docker compose restart coturn
else
  echo "$(date): no renewal needed"
fi
