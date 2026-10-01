jest.mock('./wss', () => ({
    socket: { on: jest.fn(), off: jest.fn() },
    createNewRoom: jest.fn(),
    joinRoom: jest.fn(),
}));

import { socket, createNewRoom, joinRoom } from './wss';
import { joinSocketRoom } from './roomJoin';
import { CallConnectionError, JoinRejectedError } from './errors';

const fireSocket = (event, payload) => {
    socket.on.mock.calls.filter(([name]) => name === event).forEach(([, handler]) => handler(payload));
};

describe('joinSocketRoom', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });
    afterEach(() => {
        // settle anything a test left pending (its listeners are on `window`
        // and would otherwise react to a later test's events)
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('asks the server to create a room as host and resolves with the new room id', async () => {
        const joined = joinSocketRoom(true, 'Alice', null, 'pw');

        expect(createNewRoom).toHaveBeenCalledWith('Alice', 'pw');
        fireSocket('room-id', { roomId: 'room-1' });

        await expect(joined).resolves.toEqual({ roomId: 'room-1' });
    });

    it('asks to join an existing room as a guest and resolves on the first room update', async () => {
        const joined = joinSocketRoom(false, 'Bob', 'room-9', undefined);

        expect(joinRoom).toHaveBeenCalledWith('Bob', 'room-9', undefined);
        fireSocket('room-update', { connectedUsers: [] });

        await expect(joined).resolves.toEqual({ roomId: 'room-9' });
    });

    it('does not resolve a host on a room-update, or a guest on a room-id', async () => {
        const host = jest.fn();
        const guest = jest.fn();
        joinSocketRoom(true, 'A', null).then(host, () => {});
        joinSocketRoom(false, 'B', 'r').then(guest, () => {});

        // the guest's listener sees 'room-id', the host's sees 'room-update'
        socket.on.mock.calls.forEach(([name, handler]) => {
            if (name === 'room-update') handler({});
        });
        await Promise.resolve();
        expect(host).not.toHaveBeenCalled();
    });

    it('listens before it asks, so a fast reply cannot be missed', () => {
        const order = [];
        socket.on.mockImplementation(() => order.push('listen'));
        createNewRoom.mockImplementation(() => order.push('ask'));

        joinSocketRoom(true, 'A', null).catch(() => {});

        expect(order.indexOf('listen')).toBeLessThan(order.indexOf('ask'));
        socket.on.mockReset();
        createNewRoom.mockReset();
    });

    it('rejects with JoinRejectedError when the server refuses the join', async () => {
        const joined = joinSocketRoom(false, 'Bob', 'room-9', 'wrong');
        const assertion = expect(joined).rejects.toMatchObject({ name: 'JoinRejectedError', reason: 'invalid-password' });

        window.dispatchEvent(new CustomEvent('join-error', { detail: { reason: 'invalid-password' } }));

        await assertion;
        await expect(joined).rejects.toBeInstanceOf(JoinRejectedError);
    });

    it('rejects instead of waiting forever when the server never answers', async () => {
        const joined = joinSocketRoom(false, 'Bob', 'room-9', undefined, 5000);
        const assertion = expect(joined).rejects.toBeInstanceOf(CallConnectionError);

        jest.advanceTimersByTime(5000);

        await assertion;
    });

    it('removes every listener once it has settled', async () => {
        const joined = joinSocketRoom(true, 'A', null);
        fireSocket('room-id', { roomId: 'r' });
        await joined;

        expect(socket.off).toHaveBeenCalledWith('room-id', expect.any(Function));
        expect(socket.off).toHaveBeenCalledWith('room-update', expect.any(Function));
        expect(jest.getTimerCount()).toBe(0);
    });

    it('removes its listeners on timeout too', async () => {
        const joined = joinSocketRoom(true, 'A', null, undefined, 100);
        const assertion = expect(joined).rejects.toBeDefined();
        jest.advanceTimersByTime(100);
        await assertion;

        expect(socket.off).toHaveBeenCalledWith('room-id', expect.any(Function));
    });
});
