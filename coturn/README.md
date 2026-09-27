# Self-hosted TURN (coturn)

Replaces (or backstops) Twilio's TURN service with your own, at the cost of
running one small VM. The app server tries this first and only falls back to
Twilio if `TURN_SERVER_URL` / `TURN_SECRET` aren't set (see
`server/controllers/getIce.js`).

**Deploying alongside the app on EC2?** `deploy/docker-compose.yml` already
includes this coturn container - just fill in `turnserver.conf` as below and
follow `deploy/README.md` instead of the standalone steps here. This
standalone `docker-compose.yml` is for running coturn on its own, separate
VM.

## Requirements

- A VM with a **public, static IP** (Twilio/Render-style PaaS hosting won't
  work here - you need real inbound UDP). Cheapest options: a $5-6/mo
  DigitalOcean droplet, Hetzner CX22, or an AWS/GCP small instance.
- Firewall/security group open for:
  - `3478/udp` and `3478/tcp` (STUN/TURN signaling)
  - `5349/tcp` (TURN over TLS, recommended)
  - `49152-65535/udp` (relayed media - this is the wide range TURN needs)
- Docker + Docker Compose on the VM.
- A domain name pointed at the VM's IP, and a TLS cert for it (e.g. via
  `certbot`) if you want `turns://` (recommended so TURN traffic can traverse
  networks that block plain UDP/TCP TURN).

## Setup

1. `cp turnserver.conf.example turnserver.conf`
2. Fill in `external-ip` (the VM's public IP), `realm` (your domain), and
   `static-auth-secret` (generate one: `openssl rand -hex 32`).
3. TLS cert/key: on the combined EC2 deployment (`deploy/`), this is already
   handled - `turnserver.conf.example`'s cert paths point at the cert nginx's
   certbot issues (turn.ballasgang.shop is a SAN on it). Standalone, get one
   yourself (`certbot certonly --standalone -d turn.yourdomain.com`) and put
   it at `./certs/fullchain.pem` / `./certs/privkey.pem`.
4. `docker compose up -d` (skip this if deploying via `deploy/` - its
   compose file already starts coturn alongside the app)
5. On the app server (`server/.env`), set:
   ```
   TURN_SERVER_URL=turn.ballasgang.shop
   TURN_SECRET=<the same static-auth-secret from step 2>
   ```

The app server mints short-lived (1 hour) username/credential pairs per
request using that shared secret, the same pattern Twilio's managed service
uses - nothing long-lived is ever handed to the browser.

## Verifying it works

Trickle ICE test page (https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
with your TURN server's URL, username, and credential should show a `relay`
candidate. If it only shows `srflx`/`host` candidates, the UDP port range
isn't reachable from the internet - check the firewall/security group first.
