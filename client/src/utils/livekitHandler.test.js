// Explicit mock factories, rather than bare jest.mock(...) automocking -
// api.js imports axios, which ships as an ESM-only package.json that
// Jest's CJS-based automock can't parse without a factory to fall back to.
jest.mock('./api', () => ({
    getLiveKitStatus: jest.fn(),
}));

jest.mock('livekit-client', () => {
    const RoomEvent = {
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
        ParticipantDisconnected: 'participantDisconnected',
        Disconnected: 'disconnected',
        Reconnecting: 'reconnecting',
        Reconnected: 'reconnected',
        LocalTrackPublished: 'localTrackPublished',
        LocalTrackUnpublished: 'localTrackUnpublished',
        TrackMuted: 'trackMuted',
        TrackUnmuted: 'trackUnmuted',
    };

    class FakeRoom {
        constructor() {
            this.handlers = {};
            this.localParticipant = {
                trackPublications: new Map(),
                setCameraEnabled: jest.fn().mockResolvedValue(undefined),
                setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
                setScreenShareEnabled: jest.fn().mockResolvedValue(undefined),
                publishTrack: jest.fn((track) => FakeRoom.publishImpl(track)),
            };
            this.remoteParticipants = new Map();
            this.connect = jest.fn((url, token) => FakeRoom.connectImpl(url, token));
            this.disconnect = jest.fn();
            FakeRoom.instances.push(this);
        }

        on(event, cb) {
            this.handlers[event] = cb;
            return this;
        }

        // exposed for tests to fire a room event as LiveKit itself would
        fire(event, ...args) {
            this.handlers[event]?.(...args);
        }
    }
    FakeRoom.instances = [];
    FakeRoom.connectImpl = () => Promise.resolve();
    FakeRoom.publishImpl = () => Promise.resolve();

    return {
        Room: FakeRoom,
        RoomEvent,
        createLocalTracks: jest.fn(),
    };
});

jest.mock('./wss', () => ({
    socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn(), id: 'local-socket-id' },
    createNewRoom: jest.fn(),
    joinRoom: jest.fn(),
    requestLiveKitToken: jest.fn(),
}));

const makeTrack = (id, kind, readyState = 'live') => ({
    id,
    kind,
    stop: jest.fn(),
    mediaStreamTrack: { id, kind, readyState },
});

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

// lets every already-queued promise continuation run
const flush = async (rounds = 30) => {
    for (let i = 0; i < rounds; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
};

describe('livekitHandler', () => {
    // Everything below is (re-)required fresh inside beforeEach, after
    // jest.resetModules() - a static top-level import would keep pointing at
    // the first test's module instances (and their jest.fn mocks) even after
    // the module registry is reset for the next test, silently testing the
    // wrong object.
    let livekitHandler;
    let callSession;
    let api;
    let wss;
    let Room;
    let createLocalTracks;

    let localStreamEvents;
    let remoteStreamEvents;
    let removeRemoteEvents;
    let statusEvents;
    let endedEvents;
    let screenShareEndedEvents;
    const listeners = [];

    const listen = (name, sink) => {
        const handler = (e) => sink.push(e.detail);
        window.addEventListener(name, handler);
        listeners.push([name, handler]);
    };

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        localStreamEvents = [];
        remoteStreamEvents = [];
        removeRemoteEvents = [];
        statusEvents = [];
        endedEvents = [];
        screenShareEndedEvents = [];
        listen('catch-local-stream', localStreamEvents);
        listen('catch-remote-stream', remoteStreamEvents);
        listen('remove-remote-stream', removeRemoteEvents);
        listen('call-status', statusEvents);
        listen('call-ended', endedEvents);
        listen('screen-share-ended', screenShareEndedEvents);

        // eslint-disable-next-line global-require
        ({ Room, createLocalTracks } = require('livekit-client'));
        Room.instances.length = 0;
        Room.connectImpl = () => Promise.resolve();
        Room.publishImpl = () => Promise.resolve();
        // eslint-disable-next-line global-require
        wss = require('./wss');
        wss.requestLiveKitToken.mockResolvedValue({ token: 'tok', url: 'wss://livekit.example.com' });
        // eslint-disable-next-line global-require
        api = require('./api');
        // eslint-disable-next-line global-require
        callSession = require('./callSession');
        // eslint-disable-next-line global-require
        livekitHandler = require('./livekitHandler');
    });

    afterEach(() => {
        listeners.splice(0).forEach(([name, handler]) => window.removeEventListener(name, handler));
        jest.useRealTimers();
    });

    const statuses = () => statusEvents.map((e) => e.status);

    const triggerSocketEvent = (eventName, payload) => {
        wss.socket.on.mock.calls
            .filter(([event]) => event === eventName)
            .forEach(([, handler]) => handler(payload));
    };

    // waits until the flow has reached the "join the room" step (it is
    // listening for the server's answer)
    const untilJoining = async () => {
        for (let i = 0; i < 200 && !wss.socket.on.mock.calls.some(([e]) => e === 'room-id'); i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }
        expect(wss.socket.on.mock.calls.some(([e]) => e === 'room-id')).toBe(true);
    };

    const start = (localTracks, { isHost = true, onlyAudio = false } = {}) => {
        createLocalTracks.mockResolvedValue(localTracks);
        const sessionId = callSession.beginSession();
        const flow = livekitHandler.startLiveKitFlow(isHost, 'Alice', isHost ? null : 'room-9', onlyAudio, undefined, sessionId);
        return { flow, sessionId };
    };

    const connectAsHost = async (localTracks = [makeTrack('cam-1', 'video'), makeTrack('mic-1', 'audio')]) => {
        const { flow, sessionId } = start(localTracks);
        await untilJoining();
        triggerSocketEvent('room-id', { roomId: 'room-123' });
        await flow;
        return { room: Room.instances[0], sessionId, localTracks };
    };

    describe('starting a call', () => {
        it('shows the camera preview BEFORE the room is joined, so a slow server cannot blank the screen', async () => {
            const { flow } = start([makeTrack('cam-1', 'video'), makeTrack('mic-1', 'audio')]);
            await untilJoining();

            // the join has not been answered, and nothing network-related happened yet...
            expect(Room.instances).toHaveLength(0);
            expect(wss.requestLiveKitToken).not.toHaveBeenCalled();
            // ...but the user already sees themselves
            expect(localStreamEvents).toHaveLength(1);
            expect(localStreamEvents[0].stream.getTracks().map((t) => t.id)).toEqual(['cam-1', 'mic-1']);

            triggerSocketEvent('room-id', { roomId: 'r' });
            await flow;
        });

        it('connects as host, publishes the tracks it already captured, and reports progress in order', async () => {
            const { room, localTracks } = await connectAsHost();

            expect(wss.createNewRoom).toHaveBeenCalledWith('Alice', undefined);
            expect(wss.requestLiveKitToken).toHaveBeenCalledTimes(1);
            expect(room.connect).toHaveBeenCalledWith('wss://livekit.example.com', 'tok');
            expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(2);
            localTracks.forEach((t) => expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(t));
            expect(livekitHandler.isUsingLiveKit()).toBe(true);
            expect(statuses()).toEqual(['media', 'joining', 'connecting', 'connected']);
        });

        it('joins an existing room as a guest', async () => {
            const { flow } = start([makeTrack('mic-1', 'audio')], { isHost: false });
            await untilJoining();

            expect(wss.joinRoom).toHaveBeenCalledWith('Alice', 'room-9', undefined);
            triggerSocketEvent('room-update', { connectedUsers: [] });
            await flow;

            expect(Room.instances).toHaveLength(1);
        });

        it('requests no video at all for an audio-only join', async () => {
            const { flow } = start([makeTrack('mic-1', 'audio')], { onlyAudio: true });
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });
            await flow;

            expect(createLocalTracks).toHaveBeenCalledWith({ audio: true, video: false });
        });

        it('picks up participants who were already in the room', async () => {
            Room.connectImpl = function connect() { return Promise.resolve(); };
            const { flow } = start([makeTrack('cam-1', 'video')]);
            await untilJoining();
            // the room object only exists after the token step - wait for it
            triggerSocketEvent('room-id', { roomId: 'r' });
            for (let i = 0; i < 100 && Room.instances.length === 0; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }
            Room.instances[0].remoteParticipants.set('peer-1', {
                identity: 'peer-1',
                trackPublications: new Map([['cam', { track: makeTrack('peer-cam', 'video') }]]),
            });
            await flow;

            expect(remoteStreamEvents.at(-1).streams.map((s) => s.id)).toEqual(['peer-1']);
        });
    });

    describe('when something goes wrong', () => {
        it('reports a camera/mic failure untouched and never joins the room', async () => {
            const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
            createLocalTracks.mockRejectedValue(denied);
            const sessionId = callSession.beginSession();

            await expect(livekitHandler.startLiveKitFlow(true, 'Alice', null, false, undefined, sessionId)).rejects.toBe(denied);

            expect(wss.createNewRoom).not.toHaveBeenCalled();
            expect(livekitHandler.isUsingLiveKit()).toBe(false);
            expect(statuses()).not.toContain('connected');
        });

        it('gives up on a join the server never answers, keeping the preview and freeing the camera', async () => {
            jest.useFakeTimers();
            const tracks = [makeTrack('cam-1', 'video'), makeTrack('mic-1', 'audio')];
            const { flow } = start(tracks);
            const outcome = expect(flow).rejects.toMatchObject({ name: 'CallConnectionError', message: expect.stringMatching(/joining the room/i) });
            await untilJoining();

            expect(localStreamEvents).toHaveLength(1); // preview is up while we wait
            jest.advanceTimersByTime(15000);

            await outcome;
            tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
            expect(Room.instances).toHaveLength(0);
            expect(livekitHandler.isUsingLiveKit()).toBe(false);
        });

        it('stops quietly and releases the camera when the server refuses the join', async () => {
            const tracks = [makeTrack('cam-1', 'video')];
            const { flow } = start(tracks);
            await untilJoining();

            window.dispatchEvent(new CustomEvent('join-error', { detail: { reason: 'invalid-password' } }));

            await expect(flow).resolves.toBeUndefined();
            expect(tracks[0].stop).toHaveBeenCalled();
            expect(Room.instances).toHaveLength(0);
            expect(wss.requestLiveKitToken).not.toHaveBeenCalled();
        });

        it('fails with a connection error when no call token can be obtained', async () => {
            const { CallConnectionError } = require('./errors');
            wss.requestLiveKitToken.mockRejectedValue(new CallConnectionError('no token'));
            const tracks = [makeTrack('cam-1', 'video')];
            const { flow } = start(tracks);
            const outcome = expect(flow).rejects.toBeInstanceOf(CallConnectionError);
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });

            await outcome;
            expect(tracks[0].stop).toHaveBeenCalled();
            expect(Room.instances).toHaveLength(0);
        });

        it('gives up when the media server never accepts the connection, and shuts that attempt down', async () => {
            jest.useFakeTimers();
            Room.connectImpl = () => new Promise(() => {});
            const tracks = [makeTrack('cam-1', 'video')];
            const { flow } = start(tracks);
            const outcome = expect(flow).rejects.toMatchObject({ name: 'CallConnectionError', message: expect.stringMatching(/media server/i) });
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });
            for (let i = 0; i < 100 && Room.instances.length === 0; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }
            await flush();

            jest.advanceTimersByTime(livekitHandler.CONNECT_TIMEOUT_MS);

            await outcome;
            // disconnecting also stops a late connect() from completing and leaving a live session behind
            expect(Room.instances[0].disconnect).toHaveBeenCalled();
            expect(tracks[0].stop).toHaveBeenCalled();
            expect(livekitHandler.isUsingLiveKit()).toBe(false);
        });

        it('wraps a connect failure so the UI blames the connection, not the camera', async () => {
            Room.connectImpl = () => Promise.reject(new Error('ws failed'));
            const { flow } = start([makeTrack('cam-1', 'video')]);
            const outcome = expect(flow).rejects.toMatchObject({ name: 'CallConnectionError', cause: expect.any(Error) });
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });

            await outcome;
        });

        it('gives up when publishing never completes', async () => {
            jest.useFakeTimers();
            Room.publishImpl = () => new Promise(() => {});
            const { flow } = start([makeTrack('cam-1', 'video')]);
            const outcome = expect(flow).rejects.toMatchObject({ name: 'CallConnectionError', message: expect.stringMatching(/publishing/i) });
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });
            for (let i = 0; i < 100 && !(Room.instances[0] && Room.instances[0].localParticipant.publishTrack.mock.calls.length); i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }

            jest.advanceTimersByTime(livekitHandler.PUBLISH_TIMEOUT_MS);

            await outcome;
        });
    });

    describe('cancelling a call that is still connecting', () => {
        it('does not finish joining after the user left while the token was pending', async () => {
            const token = deferred();
            wss.requestLiveKitToken.mockReturnValue(token.promise);
            const tracks = [makeTrack('cam-1', 'video')];
            const { flow } = start(tracks);
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });
            await flush();

            callSession.endSession(); // the user pressed Leave
            token.resolve({ token: 'tok', url: 'wss://x' });

            await expect(flow).resolves.toBeUndefined();
            expect(Room.instances).toHaveLength(0);
            expect(tracks[0].stop).toHaveBeenCalled();
            expect(statuses()).not.toContain('connected');
        });

        it('disconnects a room that finished connecting after the user had already left', async () => {
            const connect = deferred();
            Room.connectImpl = () => connect.promise;
            const tracks = [makeTrack('cam-1', 'video')];
            const { flow } = start(tracks);
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r' });
            for (let i = 0; i < 100 && Room.instances.length === 0; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }

            callSession.endSession();
            connect.resolve();

            await expect(flow).resolves.toBeUndefined();
            expect(Room.instances[0].disconnect).toHaveBeenCalled();
            expect(tracks[0].stop).toHaveBeenCalled();
            expect(Room.instances[0].localParticipant.publishTrack).not.toHaveBeenCalled();
            expect(endedEvents).toHaveLength(0); // our own cleanup is not "the call dropped"
        });

        it('never lets a cancelled attempt tear down the attempt that replaced it', async () => {
            // attempt A: stuck connecting
            const connectA = deferred();
            Room.connectImpl = () => connectA.promise;
            const tracksA = [makeTrack('cam-a', 'video')];
            const { flow: flowA } = start(tracksA);
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'a' });
            for (let i = 0; i < 100 && Room.instances.length === 0; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.resolve();
            }
            const roomA = Room.instances[0];

            // the user retries: attempt B connects normally
            wss.socket.on.mockClear();
            Room.connectImpl = () => Promise.resolve();
            const tracksB = [makeTrack('cam-b', 'video')];
            const { flow: flowB } = start(tracksB);
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'b' });
            await flowB;
            const roomB = Room.instances[1];

            // now A's connect finally completes
            connectA.resolve();
            await flowA;

            expect(roomA.disconnect).toHaveBeenCalled();
            expect(roomB.disconnect).not.toHaveBeenCalled();
            expect(tracksB[0].stop).not.toHaveBeenCalled();
            expect(livekitHandler.isUsingLiveKit()).toBe(true);
        });
    });

    describe('local camera and microphone', () => {
        it('polls and re-dispatches the local stream after a camera toggle, deduping unchanged reads', async () => {
            const camTrack = makeTrack('cam-1', 'video');
            const { room } = await connectAsHost([camTrack]);
            jest.useFakeTimers();
            room.localParticipant.trackPublications.set('cam', { track: camTrack });
            localStreamEvents.length = 0;

            await livekitHandler.setLiveKitCameraEnabled(true);
            expect(room.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
            // the toggle's own synchronous first poll tick already dispatched once
            expect(localStreamEvents).toHaveLength(1);

            // two more scheduled ticks (150ms apart) with an unchanged track -
            // the dedup in refreshLocalStream should suppress both repeats
            localStreamEvents.length = 0;
            jest.advanceTimersByTime(150 * 2);
            expect(localStreamEvents).toHaveLength(0);

            // now simulate LiveKit finishing the restart with a *new* track id,
            // picked up by the next still-scheduled poll tick
            room.localParticipant.trackPublications.set('cam', { track: makeTrack('cam-2', 'video') });
            jest.advanceTimersByTime(150);

            expect(localStreamEvents).toHaveLength(1);
            expect(localStreamEvents[0].stream.getTracks().map((t) => t.id)).toEqual(['cam-2']);
            jest.clearAllTimers();
        });

        it('keeps a screen share out of the self-view', async () => {
            const camTrack = makeTrack('cam-1', 'video');
            const { room } = await connectAsHost([camTrack]);
            jest.useFakeTimers();
            room.localParticipant.trackPublications.set('cam', { track: camTrack, source: 'camera' });
            room.localParticipant.trackPublications.set('screen', { track: makeTrack('screen-1', 'video'), source: 'screen_share' });
            localStreamEvents.length = 0;

            await livekitHandler.setLiveKitMicEnabled(true);

            expect(localStreamEvents.at(-1).stream.getTracks().map((t) => t.id)).toEqual(['cam-1']);
            jest.clearAllTimers();
        });

        it('dedupes a second identical local mute/unmute refresh', async () => {
            const camTrack = makeTrack('cam-1', 'video');
            const { room } = await connectAsHost([camTrack]);
            jest.useFakeTimers();
            room.localParticipant.trackPublications.set('cam', { track: camTrack });

            // first event primes lastLocalTrackSignature and always dispatches
            room.fire('trackMuted', {}, { isLocal: true, identity: 'local-socket-id' });
            expect(localStreamEvents.length).toBeGreaterThan(0);

            // an identical follow-up read (nothing actually changed) should not
            // spam the local preview with a new MediaStream every poll tick
            localStreamEvents.length = 0;
            room.fire('trackMuted', {}, { isLocal: true, identity: 'local-socket-id' });
            expect(localStreamEvents).toHaveLength(0);
            jest.clearAllTimers();
        });

        it('is a no-op when toggling before any room is connected', async () => {
            await expect(livekitHandler.setLiveKitCameraEnabled(true)).resolves.toBeUndefined();
            await expect(livekitHandler.setLiveKitMicEnabled(true)).resolves.toBeUndefined();
            await expect(livekitHandler.setLiveKitScreenShareEnabled(true)).resolves.toBeUndefined();
            expect(localStreamEvents).toHaveLength(0);
        });

        it('lets a failed toggle reject so the caller can undo the button state', async () => {
            const { room } = await connectAsHost();
            room.localParticipant.setCameraEnabled.mockRejectedValue(new Error('device busy'));

            await expect(livekitHandler.setLiveKitCameraEnabled(true)).rejects.toThrow('device busy');
        });

        it('passes screen sharing through to LiveKit', async () => {
            const { room } = await connectAsHost();

            await livekitHandler.setLiveKitScreenShareEnabled(true);

            expect(room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true);
        });

        it('tells the UI when the browser\'s own "stop sharing" ends a screen share', async () => {
            const { room } = await connectAsHost();

            room.fire('localTrackUnpublished', { source: 'screen_share' });
            expect(screenShareEndedEvents).toHaveLength(1);

            room.fire('localTrackUnpublished', { source: 'camera' });
            expect(screenShareEndedEvents).toHaveLength(1);
        });
    });

    describe('remote participants', () => {
        it('updates a remote participant stream on TrackMuted without touching the local stream', async () => {
            const { room } = await connectAsHost();
            room.remoteParticipants.set('peer-1', {
                identity: 'peer-1',
                trackPublications: new Map([['cam', { track: makeTrack('remote-cam', 'video') }]]),
            });
            localStreamEvents.length = 0;

            room.fire('trackMuted', {}, { isLocal: false, identity: 'peer-1' });

            expect(localStreamEvents).toHaveLength(0);
            const [{ streams }] = remoteStreamEvents.slice(-1);
            expect(streams.map((s) => s.id)).toEqual(['peer-1']);
            expect(streams[0].stream.getTracks().map((t) => t.id)).toEqual(['remote-cam']);
        });

        it('swaps a muted remote camera for the avatar straight away, and restores it on unmute', async () => {
            const { room } = await connectAsHost();
            const cam = makeTrack('remote-cam', 'video');
            const mic = makeTrack('remote-mic', 'audio');
            const camPublication = { kind: 'video', track: cam };
            room.remoteParticipants.set('peer-1', {
                identity: 'peer-1',
                trackPublications: new Map([['cam', camPublication], ['mic', { kind: 'audio', track: mic }]]),
            });
            room.fire('trackSubscribed', cam, camPublication, { identity: 'peer-1' });
            room.fire('trackSubscribed', mic, {}, { identity: 'peer-1' });

            room.fire('trackMuted', camPublication, { isLocal: false, identity: 'peer-1' });
            const [{ stream }] = remoteStreamEvents.at(-1).streams;
            expect(stream.getTracks().map((t) => t.id)).toEqual(['remote-mic']); // camera gone, audio kept

            room.fire('trackUnmuted', camPublication, { isLocal: false, identity: 'peer-1' });
            expect(stream.getTracks().map((t) => t.id).sort()).toEqual(['remote-cam', 'remote-mic']);
        });

        it('leaves a muted remote microphone alone', async () => {
            const { room } = await connectAsHost();
            const mic = makeTrack('remote-mic', 'audio');
            const micPublication = { kind: 'audio', track: mic };
            room.remoteParticipants.set('peer-1', { identity: 'peer-1', trackPublications: new Map([['mic', micPublication]]) });
            room.fire('trackSubscribed', mic, micPublication, { identity: 'peer-1' });

            room.fire('trackMuted', micPublication, { isLocal: false, identity: 'peer-1' });

            const [{ stream }] = remoteStreamEvents.at(-1).streams;
            expect(stream.getTracks().map((t) => t.id)).toEqual(['remote-mic']);
        });

        it('adds a remote stream on TrackSubscribed and removes it on ParticipantDisconnected', async () => {
            const { room } = await connectAsHost();

            room.fire('trackSubscribed', makeTrack('remote-cam', 'video'), {}, { identity: 'peer-2' });
            expect(remoteStreamEvents.at(-1).streams.map((s) => s.id)).toEqual(['peer-2']);

            room.fire('participantDisconnected', { identity: 'peer-2' });
            expect(removeRemoteEvents.at(-1)).toEqual({ socketId: 'peer-2' });
        });

        it('drops a remote track that was unpublished instead of freezing on its last frame', async () => {
            const { room } = await connectAsHost();
            const cam = makeTrack('remote-cam', 'video');
            const mic = makeTrack('remote-mic', 'audio');
            room.fire('trackSubscribed', cam, {}, { identity: 'peer-3' });
            room.fire('trackSubscribed', mic, {}, { identity: 'peer-3' });
            cam.detach = jest.fn();

            room.fire('trackUnsubscribed', cam, {}, { identity: 'peer-3' });

            expect(cam.detach).toHaveBeenCalled();
            const { streams } = remoteStreamEvents.at(-1);
            expect(streams[0].stream.getTracks().map((t) => t.id)).toEqual(['remote-mic']);
        });

        it('forgets everyone once the call is left, so a later call starts clean', async () => {
            const { room } = await connectAsHost();
            room.fire('trackSubscribed', makeTrack('remote-cam', 'video'), {}, { identity: 'old-peer' });

            livekitHandler.disconnectLiveKitRoom();
            wss.socket.on.mockClear();
            remoteStreamEvents.length = 0;
            const sessionId = callSession.beginSession();
            createLocalTracks.mockResolvedValue([makeTrack('cam-2', 'video')]);
            const flow = livekitHandler.startLiveKitFlow(true, 'Alice', null, false, undefined, sessionId);
            await untilJoining();
            triggerSocketEvent('room-id', { roomId: 'r2' });
            await flow;
            Room.instances[1].fire('trackSubscribed', makeTrack('new-cam', 'video'), {}, { identity: 'new-peer' });

            expect(remoteStreamEvents.at(-1).streams.map((s) => s.id)).toEqual(['new-peer']);
        });
    });

    describe('losing the connection', () => {
        it('shows a reconnecting state while LiveKit retries, then recovers', async () => {
            const { room } = await connectAsHost();
            statusEvents.length = 0;

            room.fire('reconnecting');
            room.fire('reconnected');

            expect(statuses()).toEqual(['reconnecting', 'connected']);
        });

        it('ends the call when the media server drops us for good', async () => {
            const { room } = await connectAsHost();

            room.fire('disconnected');

            expect(endedEvents).toEqual([{ reason: 'media-disconnected' }]);
            expect(livekitHandler.isUsingLiveKit()).toBe(false);
        });

        it('does not report a drop when we are the ones who left', async () => {
            const { room } = await connectAsHost();

            livekitHandler.disconnectLiveKitRoom();
            room.fire('disconnected'); // LiveKit echoes our own disconnect

            expect(room.disconnect).toHaveBeenCalled();
            expect(endedEvents).toHaveLength(0);
        });
    });

    describe('isLiveKitAvailable', () => {
        it('reflects what the server reports', async () => {
            api.getLiveKitStatus.mockResolvedValueOnce({ enabled: true });
            expect(await livekitHandler.isLiveKitAvailable()).toBe(true);

            api.getLiveKitStatus.mockResolvedValueOnce({ enabled: false });
            expect(await livekitHandler.isLiveKitAvailable()).toBe(false);
        });

        it('treats an unreachable server as "not available"', async () => {
            api.getLiveKitStatus.mockRejectedValue(new Error('network'));

            expect(await livekitHandler.isLiveKitAvailable()).toBe(false);
        });
    });
});
