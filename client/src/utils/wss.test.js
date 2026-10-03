const mockHandlers = {};
const mockSocket = {
    id: 'my-id',
    connected: true,
    on: jest.fn((event, handler) => { mockHandlers[event] = handler; }),
    emit: jest.fn(),
    timeout: jest.fn(),
};
jest.mock('socket.io-client', () => jest.fn(() => mockSocket));
jest.mock('../store/store', () => ({ store: { dispatch: jest.fn(), getState: jest.fn(() => ({ roomId: 'room-1' })) } }));
jest.mock('./webRTCHandler', () => ({
    prepareNewPeerConnection: jest.fn(),
    handleSignalingData: jest.fn(),
    removePeerConnection: jest.fn(),
    isLocalVideoEnabled: jest.fn(),
}));
jest.mock('./livekitHandler', () => ({ isUsingLiveKit: jest.fn(() => false) }));

import io from 'socket.io-client';
import * as wss from './wss';
import { store } from '../store/store';
import * as webRTCHandler from './webRTCHandler';
import { isUsingLiveKit } from './livekitHandler';
import { CallConnectionError } from './errors';

const collect = (name) => {
    const events = [];
    const handler = (e) => events.push(e.detail === undefined ? null : e.detail);
    window.addEventListener(name, handler);
    return { events, stop: () => window.removeEventListener(name, handler) };
};

describe('wss', () => {
    beforeAll(() => {
        wss.connectWithSocketIOServer();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSocket.connected = true;
        isUsingLiveKit.mockReturnValue(false);
        store.getState.mockReturnValue({ roomId: 'room-1' });
    });

    it('creates the socket once, however many times it is asked', () => {
        io.mockClear();

        const first = wss.connectWithSocketIOServer();
        const second = wss.connectWithSocketIOServer();

        expect(first).toBe(second);
        expect(io).not.toHaveBeenCalled(); // already created in beforeAll
    });

    describe('keeping the store in step with the server', () => {
        it('stores the new room id', () => {
            mockHandlers['room-id']({ roomId: 'abc' });

            expect(store.dispatch).toHaveBeenCalledWith({ type: 'SET_ROOM_ID', roomId: 'abc' });
        });

        it('stores the participant list', () => {
            const users = [{ socketId: 'a' }];

            mockHandlers['room-update']({ connectedUsers: users });

            expect(store.dispatch).toHaveBeenCalledWith({ type: 'SET_PARTICIPANTS', participants: users });
        });

        it('can forget the room', () => {
            wss.resetRoomState();

            expect(store.dispatch).toHaveBeenCalledWith({ type: 'SET_ROOM_ID', roomId: null });
            expect(store.dispatch).toHaveBeenCalledWith({ type: 'SET_PARTICIPANTS', participants: [] });
        });
    });

    describe('peer-to-peer signalling', () => {
        it('drives the mesh when the mesh is the transport', () => {
            mockHandlers['prepare-webRTC']({ connUserSocketId: 'p' });
            mockHandlers['conn-init']({ connUserSocketId: 'p' });
            mockHandlers['conn-signal']({ signal: {}, connUserSocketId: 'p' });
            mockHandlers['user-disconnected']({ socketId: 'p' });

            expect(webRTCHandler.prepareNewPeerConnection).toHaveBeenCalledWith('p', false);
            expect(webRTCHandler.prepareNewPeerConnection).toHaveBeenCalledWith('p', true);
            expect(mockSocket.emit).toHaveBeenCalledWith('conn-init', { connUserSocketId: 'p' });
            expect(webRTCHandler.handleSignalingData).toHaveBeenCalled();
            expect(webRTCHandler.removePeerConnection).toHaveBeenCalledWith({ socketId: 'p' });
        });

        it('ignores all of it when LiveKit is carrying the media', () => {
            isUsingLiveKit.mockReturnValue(true);

            mockHandlers['prepare-webRTC']({ connUserSocketId: 'p' });
            mockHandlers['conn-init']({ connUserSocketId: 'p' });
            mockHandlers['conn-signal']({ signal: {}, connUserSocketId: 'p' });
            mockHandlers['user-disconnected']({ socketId: 'p' });

            expect(webRTCHandler.prepareNewPeerConnection).not.toHaveBeenCalled();
            expect(webRTCHandler.handleSignalingData).not.toHaveBeenCalled();
            expect(webRTCHandler.removePeerConnection).not.toHaveBeenCalled();
        });
    });

    describe('camera state', () => {
        it('tells the room whether our camera is on', () => {
            wss.sendMediaState(false);
            wss.sendMediaState(true);

            expect(mockSocket.emit).toHaveBeenCalledWith('media-state', { video: false });
            expect(mockSocket.emit).toHaveBeenCalledWith('media-state', { video: true });
        });

        it('does not try over a dead connection', () => {
            mockSocket.connected = false;

            wss.sendMediaState(false);

            expect(mockSocket.emit).not.toHaveBeenCalled();
        });

        it('passes other people\'s camera state to the UI', () => {
            const { events, stop } = collect('remote-media-state');

            mockHandlers['media-state']({ socketId: 'p', video: false });

            expect(events).toEqual([{ socketId: 'p', video: false }]);
            stop();
        });

        it('tells a newcomer the current camera state when they arrive, since they missed any earlier change', () => {
            webRTCHandler.isLocalVideoEnabled.mockReturnValue(false);

            mockHandlers['prepare-webRTC']({ connUserSocketId: 'newcomer' });

            expect(mockSocket.emit).toHaveBeenCalledWith('media-state', { video: false });
        });
    });

    describe('events the UI listens for', () => {
        it.each([
            ['join-error', { reason: 'full' }],
            ['room-idle-warning', { secondsLeft: 60 }],
        ])('relays "%s" with its details', (name, payload) => {
            const { events, stop } = collect(name);

            mockHandlers[name](payload);

            expect(events).toEqual([payload]);
            stop();
        });

        it.each(['removed-from-room', 'room-idle-timeout'])('relays "%s"', (name) => {
            const { events, stop } = collect(name);

            mockHandlers[name]();

            expect(events).toHaveLength(1);
            stop();
        });
    });

    describe('losing the connection', () => {
        it.each(['transport close', 'ping timeout', 'io server disconnect'])('ends the call when the socket drops (%s)', (reason) => {
            const { events, stop } = collect('call-ended');

            mockHandlers.disconnect(reason);

            expect(events).toEqual([{ reason: 'connection-lost' }]);
            stop();
        });

        it('does not treat our own disconnect as a loss', () => {
            const { events, stop } = collect('call-ended');

            mockHandlers.disconnect('io client disconnect');

            expect(events).toHaveLength(0);
            stop();
        });
    });

    describe('talking to the server', () => {
        it('creates and joins rooms', () => {
            wss.createNewRoom('Alice', 'pw');
            wss.joinRoom('Bob', 'room-9', undefined);

            expect(mockSocket.emit).toHaveBeenCalledWith('create-room', { identity: 'Alice', password: 'pw' });
            expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { identity: 'Bob', roomId: 'room-9', password: undefined });
        });

        it('tells the server when we leave', () => {
            wss.leaveRoom();

            expect(mockSocket.emit).toHaveBeenCalledWith('leave-room');
        });

        it('does not try to leave over a dead connection', () => {
            mockSocket.connected = false;

            wss.leaveRoom();
            wss.extendRoom();

            expect(mockSocket.emit).not.toHaveBeenCalled();
        });

        it('asks to keep an idle room open', () => {
            wss.extendRoom();

            expect(mockSocket.emit).toHaveBeenCalledWith('extend-room');
        });

        it('sends captions and removal requests for the current room', () => {
            wss.sendCaption('hello');
            wss.removeParticipant('target');

            expect(mockSocket.emit).toHaveBeenCalledWith('send-caption', { roomId: 'room-1', text: 'hello' });
            expect(mockSocket.emit).toHaveBeenCalledWith('remove-participant', { roomId: 'room-1', targetSocketId: 'target' });
        });

        it('sends neither when not in a room', () => {
            store.getState.mockReturnValue({ roomId: null });

            wss.sendCaption('hello');
            wss.removeParticipant('target');

            expect(mockSocket.emit).not.toHaveBeenCalled();
        });

        it('relays signalling data', () => {
            wss.signalPeerData({ a: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('conn-signal', { a: 1 });
        });
    });

    describe('requestLiveKitToken', () => {
        const respondWith = (...args) => {
            const emit = jest.fn((event, data, cb) => cb(...args));
            mockSocket.timeout.mockReturnValue({ emit });
            return emit;
        };

        it('asks over the socket, with a timeout, and resolves with the token', async () => {
            const emit = respondWith(null, { token: 't', url: 'wss://x' });

            await expect(wss.requestLiveKitToken()).resolves.toEqual({ token: 't', url: 'wss://x' });

            expect(mockSocket.timeout).toHaveBeenCalledWith(10000);
            expect(emit).toHaveBeenCalledWith('livekit-token', {}, expect.any(Function));
        });

        it('rejects with a connection error when the server does not answer in time', async () => {
            respondWith(new Error('operation has timed out'));

            await expect(wss.requestLiveKitToken()).rejects.toBeInstanceOf(CallConnectionError);
        });

        it('rejects with the server\'s reason when it refuses', async () => {
            respondWith(null, { error: 'not-in-room' });

            await expect(wss.requestLiveKitToken()).rejects.toMatchObject({ name: 'CallConnectionError', message: expect.stringContaining('not-in-room') });
        });

        it('rejects on an empty reply', async () => {
            respondWith(null, undefined);

            await expect(wss.requestLiveKitToken()).rejects.toBeInstanceOf(CallConnectionError);
        });
    });
});
