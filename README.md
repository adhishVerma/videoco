# Videoco

A browser-based video calling app - create a room, share the link, and talk. No accounts, no downloads.

**Live demo:** http://videoco.vercel.app/

## Features

- Multi-participant video/audio calls, with a peer-to-peer mesh fallback when no SFU is configured
- Screen sharing
- Live captions (Web Speech API - nothing installed or configured)
- In-call chat with file attachments (images, video, audio, PDFs get inline previews; everything else gets a download card)
- Password-protected rooms
- Host moderation - the room creator can remove a participant mid-call

## Architecture

```
┌─────────────┐        socket.io (control plane)        ┌─────────────┐
│  Browser A  │ ───────────────────────────────────────▶│   Express    │
│             │ ◀─────────────────────────────────────── │  + socket.io │
└──────┬──────┘        room membership, chat,             └──────┬──────┘
       │                captions, moderation                     │
       │                                                          │
       │                    media transport                       │
       │        ┌───────────────────┴───────────────────┐         │
       │        │                                         │         │
       ▼        ▼                                         ▼         ▼
 ┌──────────────────┐                            ┌──────────────────┐
 │   LiveKit SFU     │  (if configured)           │  WebRTC mesh     │
 │  audio/video/      │◀───────────────────────── │  (fallback)      │
 │  screen share      │      not configured        │  direct P2P      │
 └──────────────────┘                            └──────────────────┘
```

**Control plane vs. media plane, kept separate on purpose.** socket.io is always the source of truth for who's in a room, chat messages, captions, and moderation - regardless of how video actually gets from one browser to another. Media transport is pluggable:

- **LiveKit SFU** (`LIVEKIT_*` env vars set) - each participant publishes one stream to a LiveKit server, which fans it out to everyone else. Scales past a handful of participants and handles reconnects gracefully.
- **WebRTC mesh fallback** (nothing configured) - browsers connect directly to each other via `simple-peer`. Works with zero external services, degrades past ~4 participants.

The client checks `/api/livekit-status` once on connect and picks a transport. Everything above that layer (`Stream.jsx`, `Video.jsx`, the chat, captions) talks to a small set of `window` CustomEvents (`catch-local-stream`, `catch-remote-stream`, `remove-remote-stream`) and doesn't know or care which transport is active.

**File attachments** upload directly from the browser to a Cloudflare R2 bucket via a server-issued pre-signed URL - file bytes never pass through the app server.

## Tech stack

- **Client:** React, Redux, Tailwind CSS, `livekit-client`, `simple-peer`, socket.io-client
- **Server:** Node.js, Express, socket.io, `livekit-server-sdk`
- **Storage:** Cloudflare R2 (S3-compatible) for chat attachments
- **Testing:** Jest + React Testing Library (client), Jest + Supertest-style controller tests (server)

## Running locally

```bash
# server
cd server
cp .env.example .env   # fill in what you need - see below
npm install
npm run dev             # http://localhost:5000

# client
cd client
npm install
npm start                # http://localhost:3000
```

The app runs with zero configuration beyond `CLIENT_URL`/`REACT_APP_BACKEND_URL` - LiveKit, R2 attachments, and TURN credentials are all optional. Without them you get the P2P mesh, no attachments, and STUN-only (which fails behind some NATs) respectively. See `server/.env.example` for the full list.

## Testing

```bash
cd server && npm test
cd client && npm test -- --watchAll=false
```

CI (`.github/workflows/ci.yml`) runs both suites plus a production client build on every push and PR.

## A couple of bugs worth mentioning

**The mute/unmute race condition.** Toggling your camera off and back on in LiveKit doesn't unpublish/republish the track - it calls `mute()`/`unmute()` internally, and `unmute()` reacquires a *new* `MediaStreamTrack` under the same publication. The obvious approach (listen for `LocalTrackPublished`/`LocalTrackUnpublished` and rebuild the local preview) silently did nothing, because those events never fire for a toggle - only `TrackMuted`/`TrackUnmuted` do. Fixing that exposed a second problem: the track-restart is itself asynchronous and can still be in flight after the toggle's own promise resolves, so a single refresh right after `await` could grab a track that was still `ended`. The fix polls the local participant's publications a few times over ~1.5s after any toggle, with a signature-based dedup so it doesn't spam the UI with identical `MediaStream` objects once the track has actually stabilized. See `client/src/utils/livekitHandler.js`.

**The R2 "invalid argument" auth error.** Uploads to Cloudflare R2 via a pre-signed URL were failing signature validation, even though the exact same request pattern works against real S3. Root cause: recent AWS SDK v3 versions attach a CRC32 checksum requirement to every request by default, baked into the signed query string as `x-amz-checksum-crc32`/`x-amz-sdk-checksum-algorithm`. R2 doesn't implement that AWS-specific extension the same way S3 does, so a plain PUT that doesn't send a matching checksum header fails signature validation. Fixed with one config option (`requestChecksumCalculation: 'WHEN_REQUIRED'`) once the actual cause was found - the harder part was not assuming "auth error" meant bad credentials. See `server/controllers/attachments.js`.

## Future plans

- Client-side coverage for the video-grid/chat components, not just utils
- Rate limiting on room creation and a lobby/waiting-room approval step
- Recording
- TypeScript migration
