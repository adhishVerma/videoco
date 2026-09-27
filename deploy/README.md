# Deploying the backend to EC2

The frontend stays on Vercel. This covers moving just the backend (Express +
Socket.IO server, plus the optional self-hosted TURN server) to your own EC2
instance, reachable at `api.ballasgang.shop` (and `turn.ballasgang.shop` for
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
| A | `api` | `<your Elastic IP>` |
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

This issues one certificate covering both `api.ballasgang.shop` and
`turn.ballasgang.shop` (nginx uses it for HTTPS/WSS; coturn reads the same
files directly for `turns://`). Renewal happens automatically afterward via
the `certbot` service in `docker-compose.yml` - nothing to schedule
yourself.

## 6. Start everything

```bash
docker compose up -d --build
```

This builds and starts `app` (the Node server), `nginx` (reverse proxy +
TLS termination), `certbot` (renewal loop), and `coturn` (if configured).

## 7. Verify

```bash
curl https://api.ballasgang.shop/api/attachments-status
curl https://api.ballasgang.shop/api/livekit-status
```

Both should return JSON, not a connection error or a cert warning. For TURN,
use the [Trickle ICE test page](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
with `turns:turn.ballasgang.shop:5349` and your credentials - you should see
a `relay` candidate.

## 8. Point Vercel at the new backend

In the Vercel project's settings → Environment Variables, set:

```
REACT_APP_BACKEND_URL=https://api.ballasgang.shop
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

**Restart everything:**
```bash
docker compose restart
```
