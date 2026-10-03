jest.mock('./wss', () => ({
    leaveRoom: jest.fn(),
    resetRoomState: jest.fn(),
    signalPeerData: jest.fn(),
    sendMediaState: jest.fn(),
}));
jest.mock('./livekitHandler', () => ({
    isLiveKitAvailable: jest.fn(),
    startLiveKitFlow: jest.fn(),
    preloadLiveKit: jest.fn(),
    disconnectLiveKitRoom: jest.fn(),
    CallConnectionError: require('./errors').CallConnectionError,
}));
jest.mock('./turn', () => ({
    fetchTURNCredentials: jest.fn(),
    getTurnIceServers: jest.fn(),
}));
jest.mock('./roomJoin', () => ({ joinSocketRoom: jest.fn() }));
jest.mock('simple-peer', () => {
    class FakePeer {
        constructor(options) {
            this.options = options;
            this.handlers = {};
            this.destroy = jest.fn();
            this.signal = jest.fn();
            this.replaceTrack = jest.fn();
            FakePeer.instances.push(this);
        }

        on(event, handler) {
            this.handlers[event] = handler;
        }
    }
    FakePeer.instances = [];
    return FakePeer;
});

import Peer from 'simple-peer';
import * as handler from './webRTCHandler';
import * as wss from './wss';
import * as livekitHandler from './livekitHandler';
import { fetchTURNCredentials, getTurnIceServers } from './turn';
import { joinSocketRoom } from './roomJoin';
import { CallConnectionError, JoinRejectedError } from './errors';
import { endSession } from './callSession';
import { makeVideoTrack, makeAudioTrack } from '../test-utils';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

const collect = (name) => {
    const events = [];
    const listener = (e) => events.push(e.detail === undefined ? null : e.detail);
    window.addEventListener(name, listener);
    return { events, stop: () => window.removeEventListener(name, listener) };
};

const makeStream = (...tracks) => new MediaStream(tracks);

describe('webRTCHandler (mesh fallback)', () => {
    let getUserMedia;
    let collectors;
    let statuses;
    let previews;

    beforeEach(() => {
        Peer.instances.length = 0;
        getUserMedia = jest.fn();
        Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });

        livekitHandler.isLiveKitAvailable.mockResolvedValue(false);
        fetchTURNCredentials.mockResolvedValue(null);
        getTurnIceServers.mockReturnValue(null);
        joinSocketRoom.mockResolvedValue({ roomId: 'room-1' });

        const status = collect('call-status');
        const preview = collect('catch-local-stream');
        collectors = [status, preview];
        statuses = () => status.events.map((e) => e.status);
        previews = preview.events;

        // leave anything a previous test left behind
        handler.leaveCall();
        jest.clearAllMocks();
        joinSocketRoom.mockResolvedValue({ roomId: 'room-1' });
        livekitHandler.isLiveKitAvailable.mockResolvedValue(false);
        fetchTURNCredentials.mockResolvedValue(null);
        status.events.length = 0;
        preview.events.length = 0;
    });

    afterEach(() => {
        collectors.forEach((c) => c.stop());
    });

    describe('starting a call', () => {
        it('shows the camera preview before it joins the room', async () => {
            const stream = makeStream(makeVideoTrack(), makeAudioTrack());
            getUserMedia.mockResolvedValue(stream);
            const join = deferred();
            joinSocketRoom.mockReturnValue(join.promise);

            const started = handler.getLocalPreviewAndInitRoomConnection(true, 'Alice', null, false, undefined);
            await new Promise((r) => setTimeout(r, 0));

            expect(previews).toHaveLength(1);
            expect(previews[0].stream).toBe(stream);
            expect(joinSocketRoom).toHaveBeenCalled();

            join.resolve({ roomId: 'r' });
            await started;
            expect(statuses()).toEqual(['starting', 'media', 'joining', 'connected']);
        });

        it('asks for audio and video normally, and audio only when asked', async () => {
            getUserMedia.mockResolvedValue(makeStream(makeAudioTrack()));

            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);
            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, true, undefined);

            expect(getUserMedia).toHaveBeenNthCalledWith(1, expect.objectContaining({ audio: true, video: expect.anything() }));
            expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true, video: false });
        });

        it('joins with the details it was given', async () => {
            getUserMedia.mockResolvedValue(makeStream(makeVideoTrack()));

            await handler.getLocalPreviewAndInitRoomConnection(false, 'Bob', 'room-9', false, 'pw');

            expect(joinSocketRoom).toHaveBeenCalledWith(false, 'Bob', 'room-9', 'pw');
        });

        it('fetches relay credentials, but does not need them to succeed', async () => {
            getUserMedia.mockResolvedValue(makeStream(makeVideoTrack()));
            fetchTURNCredentials.mockResolvedValue(null);

            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);

            expect(fetchTURNCredentials).toHaveBeenCalled();
            expect(statuses()).toContain('connected');
        });

        it('hands over to LiveKit when the server has it configured', async () => {
            livekitHandler.isLiveKitAvailable.mockResolvedValue(true);

            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, 'pw');

            expect(livekitHandler.startLiveKitFlow).toHaveBeenCalledWith(true, 'A', null, false, 'pw', expect.any(Number));
            expect(getUserMedia).not.toHaveBeenCalled();
        });

        it('starts downloading LiveKit straight away, in parallel with the server check', async () => {
            getUserMedia.mockResolvedValue(makeStream(makeVideoTrack()));

            const started = handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);

            expect(livekitHandler.preloadLiveKit).toHaveBeenCalledTimes(1);
            await started;
        });
    });

    describe('when starting fails', () => {
        it('reports a refused camera as a device problem and marks the call failed', async () => {
            const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
            getUserMedia.mockRejectedValue(denied);
            const errors = collect('media-access-error');
            jest.spyOn(console, 'log').mockImplementation(() => {});

            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);

            expect(errors.events[0].error).toBe(denied);
            expect(joinSocketRoom).not.toHaveBeenCalled();
            const failed = collectors[0].events.at(-1);
            expect(failed).toEqual({ status: 'failed', kind: 'media' });
            errors.stop();
            console.log.mockRestore();
        });

        it('reports a join that times out as a connection problem, and frees the camera', async () => {
            const track = makeVideoTrack();
            getUserMedia.mockResolvedValue(makeStream(track));
            joinSocketRoom.mockRejectedValue(new CallConnectionError('Timed out joining the room'));
            const errors = collect('call-connection-error');
            jest.spyOn(console, 'log').mockImplementation(() => {});

            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);

            expect(errors.events).toHaveLength(1);
            expect(track.stop).toHaveBeenCalled();
            expect(collectors[0].events.at(-1)).toEqual({ status: 'failed', kind: 'connection' });
            errors.stop();
            console.log.mockRestore();
        });

        it('stays quiet when the server refuses the join (Room shows that), but frees the camera', async () => {
            const track = makeVideoTrack();
            getUserMedia.mockResolvedValue(makeStream(track));
            joinSocketRoom.mockRejectedValue(new JoinRejectedError('invalid-password'));
            const errors = collect('call-connection-error');
            const mediaErrors = collect('media-access-error');

            await handler.getLocalPreviewAndInitRoomConnection(false, 'B', 'r', false, 'bad');

            expect(errors.events).toHaveLength(0);
            expect(mediaErrors.events).toHaveLength(0);
            expect(track.stop).toHaveBeenCalled();
            errors.stop();
            mediaErrors.stop();
        });
    });

    describe('cancelling', () => {
        it('releases a camera that was granted after the user had already left', async () => {
            const camera = deferred();
            getUserMedia.mockReturnValue(camera.promise);
            const track = makeVideoTrack();

            const started = handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);
            await new Promise((r) => setTimeout(r, 0));
            endSession(); // the user pressed Leave while the permission prompt was open
            camera.resolve(makeStream(track));
            await started;

            expect(track.stop).toHaveBeenCalled();
            expect(previews).toHaveLength(0);
            expect(joinSocketRoom).not.toHaveBeenCalled();
        });

        it('abandons a start whose server check came back after the user left', async () => {
            const check = deferred();
            livekitHandler.isLiveKitAvailable.mockReturnValue(check.promise);

            const started = handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);
            endSession();
            check.resolve(false);
            await started;

            expect(getUserMedia).not.toHaveBeenCalled();
            expect(livekitHandler.startLiveKitFlow).not.toHaveBeenCalled();
        });

        it('lets a newer attempt supersede an older one still waiting', async () => {
            const firstCamera = deferred();
            const firstTrack = makeVideoTrack();
            getUserMedia.mockReturnValueOnce(firstCamera.promise);
            const first = handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);
            await new Promise((r) => setTimeout(r, 0));

            getUserMedia.mockResolvedValueOnce(makeStream(makeVideoTrack()));
            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);
            firstCamera.resolve(makeStream(firstTrack));
            await first;

            expect(firstTrack.stop).toHaveBeenCalled();
            expect(previews).toHaveLength(1); // only the newer attempt showed a preview
        });
    });

    describe('leaveCall', () => {
        it('stops the camera and tells the server we left', async () => {
            const track = makeVideoTrack();
            getUserMedia.mockResolvedValue(makeStream(track));
            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);

            handler.leaveCall();

            expect(track.stop).toHaveBeenCalled();
            expect(wss.leaveRoom).toHaveBeenCalled();
            expect(livekitHandler.disconnectLiveKitRoom).toHaveBeenCalled();
            expect(wss.resetRoomState).toHaveBeenCalled();
        });

        it('keeps the room details for a retry when asked to', () => {
            handler.leaveCall({ keepRoomState: true });

            expect(wss.leaveRoom).toHaveBeenCalled();
            expect(wss.resetRoomState).not.toHaveBeenCalled();
        });

        it('destroys every peer connection', () => {
            handler.prepareNewPeerConnection('a', true);
            handler.prepareNewPeerConnection('b', false);

            handler.leaveCall();

            Peer.instances.forEach((p) => expect(p.destroy).toHaveBeenCalled());
        });

        it('is safe to call twice, or before anything started', () => {
            expect(() => { handler.leaveCall(); handler.leaveCall(); }).not.toThrow();
        });
    });

    describe('peer connections', () => {
        it('relays what a peer needs to the other side, addressed to that peer', () => {
            handler.prepareNewPeerConnection('peer-1', true);

            Peer.instances[0].handlers.signal({ sdp: 'offer' });

            expect(wss.signalPeerData).toHaveBeenCalledWith({ signal: { sdp: 'offer' }, connUserSocketId: 'peer-1' });
        });

        it('publishes an arriving stream, and replaces it rather than duplicating it', () => {
            const seen = collect('catch-remote-stream');
            handler.prepareNewPeerConnection('peer-1', false);
            const first = makeStream(makeVideoTrack());
            const second = makeStream(makeVideoTrack());

            Peer.instances[0].handlers.stream(first);
            Peer.instances[0].handlers.stream(second);

            const latest = seen.events.at(-1).streams;
            expect(latest).toHaveLength(1);
            expect(latest[0].stream).toBe(second);
            seen.stop();
        });

        it('replaces a duplicate connection to the same peer instead of leaking it', () => {
            handler.prepareNewPeerConnection('peer-1', true);
            const [first] = Peer.instances;

            handler.prepareNewPeerConnection('peer-1', true);

            expect(first.destroy).toHaveBeenCalled();
        });

        it('adds the relay servers once they are known', () => {
            getTurnIceServers.mockReturnValue([{ urls: 'turn:example' }]);

            handler.prepareNewPeerConnection('p', true);

            expect(Peer.instances[0].options.config.iceServers).toEqual([
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'turn:example' },
            ]);
        });

        it('falls back to STUN alone without relay servers', () => {
            handler.prepareNewPeerConnection('p', true);

            expect(Peer.instances[0].options.config.iceServers).toEqual([{ urls: 'stun:stun.l.google.com:19302' }]);
        });

        it('survives a peer error without taking the call down', () => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            handler.prepareNewPeerConnection('p', true);

            expect(() => Peer.instances[0].handlers.error(new Error('ice failed'))).not.toThrow();
            console.log.mockRestore();
        });

        it('forwards signalling data to the right peer, and ignores data for one that is gone', () => {
            handler.prepareNewPeerConnection('p', false);

            handler.handleSignalingData({ connUserSocketId: 'p', signal: { a: 1 } });
            expect(Peer.instances[0].signal).toHaveBeenCalledWith({ a: 1 });

            expect(() => handler.handleSignalingData({ connUserSocketId: 'unknown', signal: {} })).not.toThrow();
        });

        it('removes a peer that disconnected, and tells the UI', () => {
            const removed = collect('remove-remote-stream');
            handler.prepareNewPeerConnection('p', false);

            handler.removePeerConnection({ socketId: 'p' });

            expect(Peer.instances[0].destroy).toHaveBeenCalled();
            expect(removed.events).toEqual([{ socketId: 'p' }]);
            removed.stop();
        });

        it('still tells the UI when the departed peer never had a connection', () => {
            const removed = collect('remove-remote-stream');

            expect(() => handler.removePeerConnection({ socketId: 'ghost' })).not.toThrow();
            expect(removed.events).toEqual([{ socketId: 'ghost' }]);
            removed.stop();
        });
    });

    describe('camera state', () => {
        it('starts as on', () => {
            expect(handler.isLocalVideoEnabled()).toBe(true);
        });

        it('remembers it and tells the room', () => {
            handler.setLocalVideoEnabled(false);

            expect(handler.isLocalVideoEnabled()).toBe(false);
            expect(wss.sendMediaState).toHaveBeenCalledWith(false);
        });

        it('is back to "on" for the next call', () => {
            handler.setLocalVideoEnabled(false);

            handler.leaveCall();

            expect(handler.isLocalVideoEnabled()).toBe(true);
        });
    });

    describe('screen sharing', () => {
        const startWithCamera = async () => {
            const camera = makeVideoTrack();
            getUserMedia.mockResolvedValue(makeStream(camera));
            await handler.getLocalPreviewAndInitRoomConnection(true, 'A', null, false, undefined);
            return camera;
        };

        it('swaps what every peer receives for the screen, then back to the camera', async () => {
            const camera = await startWithCamera();
            handler.prepareNewPeerConnection('a', true);
            handler.prepareNewPeerConnection('b', true);
            const screen = makeVideoTrack();

            handler.switchVideoTracks(makeStream(screen));
            Peer.instances.forEach((p) => expect(p.replaceTrack).toHaveBeenCalledWith(camera, screen, expect.anything()));

            // switching back must replace the SCREEN track, which is what peers now hold
            handler.switchVideoTracks(makeStream(camera));
            Peer.instances.forEach((p) => expect(p.replaceTrack).toHaveBeenLastCalledWith(screen, camera, expect.anything()));
        });

        it('does nothing without a camera to swap away from', () => {
            handler.prepareNewPeerConnection('a', true);

            expect(() => handler.switchVideoTracks(makeStream(makeVideoTrack()))).not.toThrow();
            expect(Peer.instances[0].replaceTrack).not.toHaveBeenCalled();
        });

        it('keeps going if one peer cannot switch', async () => {
            await startWithCamera();
            handler.prepareNewPeerConnection('a', true);
            handler.prepareNewPeerConnection('b', true);
            Peer.instances[0].replaceTrack.mockImplementation(() => { throw new Error('closed'); });
            jest.spyOn(console, 'log').mockImplementation(() => {});

            handler.switchVideoTracks(makeStream(makeVideoTrack()));

            expect(Peer.instances[1].replaceTrack).toHaveBeenCalled();
            console.log.mockRestore();
        });
    });
});
