// Explicit mock factories, rather than bare jest.mock(...) automocking -
// api.js imports axios, which ships as an ESM-only package.json that
// Jest's CJS-based automock can't parse without a factory to fall back to.
jest.mock('./api', () => ({
    getLiveKitToken: jest.fn(),
}));

jest.mock('livekit-client', () => {
    const RoomEvent = {
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
        ParticipantDisconnected: 'participantDisconnected',
        Disconnected: 'disconnected',
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
                publishTrack: jest.fn().mockResolvedValue(undefined),
            };
            this.remoteParticipants = new Map();
            this.connect = jest.fn().mockResolvedValue(undefined);
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
}));

const makeTrack = (id, kind, readyState = 'live') => ({
    mediaStreamTrack: { id, kind, readyState },
});

describe('livekitHandler', () => {
    // Everything below is (re-)required fresh inside beforeEach, after
    // jest.resetModules() - a static top-level import would keep pointing at
    // the first test's module instances (and their jest.fn mocks) even after
    // the module registry is reset for the next test, silently testing the
    // wrong object.
    let livekitHandler;
    let api;
    let wss;
    let Room;
    let createLocalTracks;

    let localStreamEvents;
    let remoteStreamEvents;
    let removeRemoteEvents;
    let onLocalStream;
    let onRemoteStream;
    let onRemoveRemote;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        localStreamEvents = [];
        remoteStreamEvents = [];
        removeRemoteEvents = [];
        onLocalStream = (e) => localStreamEvents.push(e.detail);
        onRemoteStream = (e) => remoteStreamEvents.push(e.detail);
        onRemoveRemote = (e) => removeRemoteEvents.push(e.detail);
        window.addEventListener('catch-local-stream', onLocalStream);
        window.addEventListener('catch-remote-stream', onRemoteStream);
        window.addEventListener('remove-remote-stream', onRemoveRemote);

        // eslint-disable-next-line global-require
        ({ Room, createLocalTracks } = require('livekit-client'));
        Room.instances.length = 0;
        // eslint-disable-next-line global-require
        wss = require('./wss');
        // eslint-disable-next-line global-require
        api = require('./api');
        // eslint-disable-next-line global-require
        livekitHandler = require('./livekitHandler');
    });

    afterEach(() => {
        window.removeEventListener('catch-local-stream', onLocalStream);
        window.removeEventListener('catch-remote-stream', onRemoteStream);
        window.removeEventListener('remove-remote-stream', onRemoveRemote);
    });

    const triggerSocketEvent = (eventName, payload) => {
        const call = wss.socket.on.mock.calls.find(([event]) => event === eventName);
        call?.[1](payload);
    };

    const connectAsHost = async (localTracks) => {
        api.getLiveKitToken.mockResolvedValue({ token: 'tok', url: 'wss://livekit.example.com' });
        createLocalTracks.mockResolvedValue(localTracks);

        const flow = livekitHandler.startLiveKitFlow(true, 'Alice', null, false, undefined);
        // waitForRoomReady is listening on socket.on('room-id', ...) by now
        triggerSocketEvent('room-id', { roomId: 'room-123' });
        await flow;

        return Room.instances[0];
    };

    it('connects as host, publishes local tracks, and dispatches the local stream', async () => {
        const camTrack = makeTrack('cam-1', 'video');
        const micTrack = makeTrack('mic-1', 'audio');
        const room = await connectAsHost([camTrack, micTrack]);

        expect(wss.createNewRoom).toHaveBeenCalledWith('Alice', undefined);
        expect(api.getLiveKitToken).toHaveBeenCalledWith('room-123', 'Alice', 'local-socket-id', undefined);
        expect(room.connect).toHaveBeenCalledWith('wss://livekit.example.com', 'tok');
        expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(2);
        expect(localStreamEvents).toHaveLength(1);
        expect(localStreamEvents[0].stream.getTracks().map((t) => t.id)).toEqual(['cam-1', 'mic-1']);
        expect(livekitHandler.isUsingLiveKit()).toBe(true);
    });

    it('polls and re-dispatches the local stream after a camera toggle, deduping unchanged reads', async () => {
        jest.useFakeTimers();
        const camTrack = makeTrack('cam-1', 'video');
        const room = await connectAsHost([camTrack]);
        room.localParticipant.trackPublications.set('cam', { track: camTrack });
        localStreamEvents.length = 0;

        const togglePromise = livekitHandler.setLiveKitCameraEnabled(true);
        await togglePromise;
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
        const newCamTrack = makeTrack('cam-2', 'video');
        room.localParticipant.trackPublications.set('cam', { track: newCamTrack });
        jest.advanceTimersByTime(150);

        expect(localStreamEvents).toHaveLength(1);
        expect(localStreamEvents[0].stream.getTracks().map((t) => t.id)).toEqual(['cam-2']);

        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('dedupes a second identical local mute/unmute refresh (isLocal TrackMuted)', async () => {
        jest.useFakeTimers();
        const camTrack = makeTrack('cam-1', 'video');
        const room = await connectAsHost([camTrack]);
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
        jest.useRealTimers();
    });

    it('updates a remote participant stream on TrackMuted/TrackUnmuted without touching the local stream', async () => {
        const room = await connectAsHost([makeTrack('cam-1', 'video')]);

        const remoteTrack = makeTrack('remote-cam', 'video');
        const remoteParticipant = {
            identity: 'peer-1',
            trackPublications: new Map([['cam', { track: remoteTrack }]]),
        };
        room.remoteParticipants.set('peer-1', remoteParticipant);

        localStreamEvents.length = 0;
        room.fire('trackMuted', {}, { isLocal: false, identity: 'peer-1' });

        expect(localStreamEvents).toHaveLength(0);
        expect(remoteStreamEvents).toHaveLength(1);
        const [{ streams }] = remoteStreamEvents;
        expect(streams).toHaveLength(1);
        expect(streams[0].id).toBe('peer-1');
        expect(streams[0].stream.getTracks().map((t) => t.id)).toEqual(['remote-cam']);
    });

    it('adds a remote stream on TrackSubscribed and removes it on ParticipantDisconnected', async () => {
        await connectAsHost([makeTrack('cam-1', 'video')]);
        const room = Room.instances[0];

        const track = makeTrack('remote-cam', 'video');
        room.fire('trackSubscribed', track, {}, { identity: 'peer-2' });
        expect(remoteStreamEvents).toHaveLength(1);
        expect(remoteStreamEvents[0].streams.map((s) => s.id)).toEqual(['peer-2']);

        room.fire('participantDisconnected', { identity: 'peer-2' });
        expect(removeRemoteEvents).toHaveLength(1);
        expect(removeRemoteEvents[0]).toEqual({ socketId: 'peer-2' });
    });

    it('marks the session as not using LiveKit once disconnected', async () => {
        const room = await connectAsHost([makeTrack('cam-1', 'video')]);
        expect(livekitHandler.isUsingLiveKit()).toBe(true);

        room.fire('disconnected');

        expect(livekitHandler.isUsingLiveKit()).toBe(false);
    });

    it('is a no-op when toggling camera/mic before any room is connected', async () => {
        await expect(livekitHandler.setLiveKitCameraEnabled(true)).resolves.toBeUndefined();
        await expect(livekitHandler.setLiveKitMicEnabled(true)).resolves.toBeUndefined();
        expect(localStreamEvents).toHaveLength(0);
    });
});
