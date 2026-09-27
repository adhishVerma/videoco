# Deploying the backend to EC2

The frontend stays on Vercel. This covers moving just the backend (Express +
Socket.IO server, plus the optional self-hosted TURN server) to your own EC2
instance, reachable at `videoco.ballasgang.shop` (and `turn.ballasgang.shop` for
TURN).

## 1. Launch the EC2 instance

- Ubuntu 22.04 or 24.04 LTS, `t3.small` or larger (coturn + Node + nginx on
  one box wants a bit more than the free-tier `t2.micro`).
- **Allocate an Elastic IP** and associate it with the instance - without
  one, the public IP changes on stop/start and your DNS records break.

### Security group (inbound rules)

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | your IP only | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP redirect + ACME challenge |
| 443 | TCP | 0.0.0.0/0 | HTTPS (API + WebSocket) |
| 3478 | TCP + UDP | 0.0.0.0/0 | STUN/TURN |
| 5349 | TCP | 0.0.0.0/0 | TURN over TLS |
| 49152-65535 | UDP | 0.0.0.0/0 | TURN relayed media |

Skip the last three rows if you're not using the self-hosted TURN server
(staying on Twilio).

## 2. DNS (GoDaddy, `ballasgang.shop`)

In GoDaddy's DNS management for the domain, add two **A records** pointing
at the EC2 instance's Elastic IP:

| Type | Name | Value |
|---|---|---|
| A | `videoco` | `<your Elastic IP>` |
| A | `turn` | `<your Elastic IP>` |

Give DNS a few minutes to propagate before running `init-letsencrypt.sh`
(certbot's HTTP-01 challenge needs the domain to actually resolve here).

## 3. Install Docker on the instance

```bash
ssh ubuntu@<elastic-ip>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

## 4. Clone the repo and configure

```bash
git clone https://github.com/adhishVerma/videoco.git
cd videoco

cp server/.env.example server/.env
nano server/.env
```

Fill in `server/.env`:
- `CLIENT_URL` - your Vercel domain(s), comma-separated (e.g.
  `https://videoco.vercel.app,https://ballasgang.shop` if you also point the
  bare domain at Vercel)
- `TURN_SERVER_URL=turn.ballasgang.shop` and `TURN_SECRET=<openssl rand -hex 32>`
  if using self-hosted TURN (skip both to keep using Twilio)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` if you want Twilio as a fallback
- `R2_*` vars for attachments, `LIVEKIT_*` vars for the SFU - same as any
  other deployment, see the comments in `.env.example`

If using self-hosted TURN, also:

```bash
cp coturn/turnserver.conf.example coturn/turnserver.conf
nano coturn/turnserver.conf
```

Set `external-ip` to the Elastic IP, and `static-auth-secret` to the exact
same value as `TURN_SECRET` above.

## 5. Get the TLS certificate

```bash
cd deploy
nano init-letsencrypt.sh   # set the `email` variable near the top
./init-letsencrypt.sh
```

This issues **one certificate covering both** `videoco.ballasgang.shop` and
`turn.ballasgang.shop` (nginx uses it for HTTPS/WSS; coturn reads the same
files directly for `turns://`), and leaves nginx running against it when it's
done. The script is safe to re-run - if a real certificate already exists it
just re-verifies nginx and reloads, it never deletes or re-requests a
working cert.

## 6. Start everything else

```bash
docker compose up -d --build app coturn
```

(nginx is already running from step 5; this builds and starts the Node
server and, if configured, coturn. The `certbot` entry in
`docker-compose.yml` is intentionally not a long-running service - it's
invoked on demand by `init-letsencrypt.sh` and `renew.sh`, so leave it out
of `up`.)

## 7. Set up certificate renewal

```bash
crontab -e
```

Add:
```cron
0 */12 * * * cd /home/ubuntu/videoco/deploy && ./renew.sh >> /home/ubuntu/videoco-renew.log 2>&1
```

`renew.sh` runs `certbot renew` (a safe no-op until a cert is within 30
days of expiry) and reloads nginx + restarts coturn **only if a renewal
actually happened** - not on every run. Adjust the path if you cloned
somewhere other than `/home/ubuntu/videoco`.

## 8. Verify

```bash
curl https://videoco.ballasgang.shop/api/attachments-status
curl https://videoco.ballasgang.shop/api/livekit-status
```

Both should return JSON, not a connection error or a cert warning. For TURN,
use the [Trickle ICE test page](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
with `turns:turn.ballasgang.shop:5349` and your credentials - you should see
a `relay` candidate.

See **Troubleshooting** below for a fuller set of verification commands.

## 9. Point Vercel at the new backend

In the Vercel project's settings → Environment Variables, set:

```
REACT_APP_BACKEND_URL=https://videoco.ballasgang.shop
```

then redeploy the frontend (Vercel → Deployments → Redeploy, or push a
commit) so the build picks up the new value - Create React App bakes
`REACT_APP_*` vars in at build time, not runtime.

## Day-to-day operations

**Deploy a new version:**
```bash
git pull
docker compose up -d --build app
```

**Logs:**
```bash
docker compose logs -f app
docker compose logs -f nginx
docker compose logs -f coturn
```

**Restart everything** (skips `certbot`, which isn't meant to stay running):
```bash
docker compose restart app nginx coturn
```

## Troubleshooting

**Check what's running:**
```bash
docker ps
```

**nginx logs / config check:**
```bash
docker logs videoco-nginx --tail 100
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

**HTTP/HTTPS reachability:**
```bash
curl -I http://videoco.ballasgang.shop
curl -I https://videoco.ballasgang.shop
curl -I https://turn.ballasgang.shop
```

**Inspect the certificate** (subject, issuer, validity dates, and which
domains it actually covers):
```bash
openssl x509 -in certbot/conf/live/videoco.ballasgang.shop/fullchain.pem -noout -subject -issuer -dates
openssl x509 -in certbot/conf/live/videoco.ballasgang.shop/fullchain.pem -noout -ext subjectAltName
```
The second command should show both `DNS:videoco.ballasgang.shop` and
`DNS:turn.ballasgang.shop`.

**Test renewal without actually renewing anything:**
```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot --dry-run -d videoco.ballasgang.shop -d turn.ballasgang.shop
```

**certbot logs (from the last manual/cron renewal run):**
```bash
cat videoco-renew.log   # or wherever you pointed the cron job's output
```

**If nginx won't start at all**, it's almost always one of:
- The cert files referenced in `nginx/videoco.conf` don't exist yet - run
  `init-letsencrypt.sh` first, it creates a dummy cert specifically so this
  doesn't happen.
- `options-ssl-nginx.conf` / `ssl-dhparam.pem` are missing or empty in
  `certbot/conf/` - `init-letsencrypt.sh` fetches these from inside the
  certbot image; if that step was interrupted, delete the two files and
  re-run the script to fetch them again.
