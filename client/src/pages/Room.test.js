import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import Room from './Room';
import * as webRTCHandler from '../utils/webRTCHandler';
import { extendRoom } from '../utils/wss';
import { useMedia } from '../context/MediaStreamContext';
import { toast } from 'react-toastify';
import { renderWithStore } from '../test-utils';
import { setParticipants } from '../store/actions';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }));
jest.mock('../utils/webRTCHandler', () => ({
    getLocalPreviewAndInitRoomConnection: jest.fn(),
    leaveCall: jest.fn(),
}));
jest.mock('../utils/wss', () => ({ extendRoom: jest.fn() }));
jest.mock('../context/MediaStreamContext', () => ({ useMedia: jest.fn() }));

// the children have their own tests - here they only expose what Room hands them
jest.mock('../components/stream/Stream', () => () => <div data-testid="stream" />);
jest.mock('../components/stream/Footer', () => ({ chatToggle, unreadCount, onLeave }) => (
    <div>
        <button onClick={onLeave}>leave</button>
        <button onClick={chatToggle}>chat</button>
        <span data-testid="unread">{unreadCount}</span>
    </div>
));
jest.mock('../components/stream/ConnectionStatus', () => ({ status, kind, onRetry, onLeave }) => (
    <div data-testid="status" data-status={status} data-kind={kind}>
        <button onClick={onRetry}>retry</button>
        <button onClick={onLeave}>status-leave</button>
    </div>
));
jest.mock('../components/Chat/Chat', () => ({ isOpen, onUnread }) => (
    <div data-testid="chat" data-open={String(isOpen)}>
        <button onClick={onUnread}>new message</button>
    </div>
));

const fire = (name, detail) => act(() => { window.dispatchEvent(new CustomEvent(name, { detail })); });

describe('Room', () => {
    let media;

    const mount = (state = {}) => {
        media = {
            closeStream: jest.fn(),
            resetCallUi: jest.fn(),
            setVideoOpen: jest.fn(),
            callStatus: { status: 'connected' },
        };
        useMedia.mockReturnValue(media);
        return renderWithStore(<Room />, {
            route: '/room',
            state: { identity: 'Alice', isRoomHost: true, roomId: null, roomPassword: '', connectOnlyAudio: false, ...state },
        });
    };

    beforeEach(() => jest.clearAllMocks());

    describe('opened without a session (a page reload, or a typed-in URL)', () => {
        it('sends the user home with an explanation instead of waiting forever', () => {
            mount({ identity: '' });

            expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/expired/i), expect.anything());
            expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).not.toHaveBeenCalled();
        });

        it('renders nothing while redirecting', () => {
            const { container } = mount({ identity: '' });

            expect(container).toBeEmptyDOMElement();
        });

        it('does the same for a guest with no room to join', () => {
            mount({ isRoomHost: false, roomId: null });

            expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).not.toHaveBeenCalled();
        });

        it('does not clean up a call it never started', () => {
            const { unmount } = mount({ identity: '' });

            unmount();

            expect(webRTCHandler.leaveCall).not.toHaveBeenCalled();
        });
    });

    describe('starting the call', () => {
        it('starts as host with what the join page collected', () => {
            mount({ isRoomHost: true, identity: 'Alice', roomPassword: 'pw', connectOnlyAudio: false });

            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).toHaveBeenCalledTimes(1);
            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).toHaveBeenCalledWith(true, 'Alice', null, false, 'pw');
        });

        it('starts as a guest of the chosen room', () => {
            mount({ isRoomHost: false, identity: 'Bob', roomId: 'room-9' });

            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).toHaveBeenCalledWith(false, 'Bob', 'room-9', false, '');
        });

        it('begins from a clean UI, with the camera shown as on', () => {
            mount();

            expect(media.resetCallUi).toHaveBeenCalled();
            expect(media.setVideoOpen).toHaveBeenCalledWith(true);
        });

        it('shows the camera as off when joining audio-only', () => {
            mount({ connectOnlyAudio: true });

            expect(media.setVideoOpen).toHaveBeenCalledWith(false);
        });

        it('passes the connection status to the status display', () => {
            mount();

            expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'connected');
        });
    });

    describe('leaving', () => {
        it('releases everything when the leave button is pressed, and goes home', () => {
            mount();

            fireEvent.click(screen.getByText('leave'));

            expect(media.closeStream).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });

        it('can also be left from the failure screen', () => {
            mount();

            fireEvent.click(screen.getByText('status-leave'));

            expect(media.closeStream).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });

        it('releases the camera, connection and seat on ANY exit, such as the browser back button', () => {
            const { unmount } = mount();

            unmount();

            expect(webRTCHandler.leaveCall).toHaveBeenCalled();
            expect(media.resetCallUi).toHaveBeenCalledTimes(2); // once on the way in, once on the way out
        });
    });

    describe('retrying after a failure', () => {
        it('clears the failed attempt but keeps the room details, then starts again', () => {
            mount({ isRoomHost: false, identity: 'Bob', roomId: 'room-9', roomPassword: 'pw' });
            webRTCHandler.getLocalPreviewAndInitRoomConnection.mockClear();

            fireEvent.click(screen.getByText('retry'));

            expect(webRTCHandler.leaveCall).toHaveBeenCalledWith({ keepRoomState: true });
            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).toHaveBeenCalledWith(false, 'Bob', 'room-9', false, 'pw');
        });

        it('retries with the ORIGINAL room even if the store has changed since', () => {
            const { store } = mount({ isRoomHost: false, identity: 'Bob', roomId: 'room-9' });
            act(() => { store.dispatch({ type: 'SET_ROOM_ID', roomId: 'something-else' }); });
            webRTCHandler.getLocalPreviewAndInitRoomConnection.mockClear();

            fireEvent.click(screen.getByText('retry'));

            expect(webRTCHandler.getLocalPreviewAndInitRoomConnection).toHaveBeenCalledWith(false, 'Bob', 'room-9', false, '');
        });
    });

    describe('when the server refuses the join', () => {
        it.each([
            ['invalid-password', /wrong room password/i],
            ['not-found', /room not found/i],
            ['full', /full/i],
            ['invalid-name', /name/i],
            ['something-new', /could not join/i],
        ])('explains "%s" and returns to the join page', (reason, message) => {
            mount();

            fire('join-error', { reason });

            expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(message), expect.anything());
            expect(mockNavigate).toHaveBeenCalledWith('/join-room');
        });
    });

    describe('when the call ends underneath the user', () => {
        it('leaves cleanly when the host removes them', () => {
            mount();

            fire('removed-from-room');

            expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/host removed you/i), expect.anything());
            expect(media.closeStream).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });

        it.each([
            ['connection-lost', /lost connection to the server/i],
            ['media-disconnected', /lost connection to the call/i],
            ['something-else', /call ended/i],
        ])('leaves with an explanation when the call drops (%s)', (reason, message) => {
            mount();

            fire('call-ended', { reason });

            expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(message), expect.anything());
            expect(media.closeStream).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });

        it('leaves, and says why, when an empty room is closed', () => {
            mount();

            fire('room-idle-timeout');

            expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/closed because nobody/i), expect.anything());
            expect(media.closeStream).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    describe('device and connection errors', () => {
        it('names the device error', () => {
            mount();
            jest.spyOn(console, 'error').mockImplementation(() => {});

            fire('media-access-error', { error: { name: 'NotReadableError', message: 'busy' } });

            expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/NotReadableError/), expect.anything());
            console.error.mockRestore();
        });

        it('reports a connection error as a connection problem', () => {
            mount();
            jest.spyOn(console, 'error').mockImplementation(() => {});

            fire('call-connection-error', { error: new Error('x') });

            expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/call server/i), expect.anything());
            console.error.mockRestore();
        });
    });

    describe('the empty-room countdown', () => {
        it('warns the lone participant and lets them keep the room open', () => {
            mount();

            fire('room-idle-warning', { secondsLeft: 60 });
            expect(screen.getByRole('alert')).toHaveTextContent('1:00');

            fireEvent.click(screen.getByText('Keep room open'));

            expect(extendRoom).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('takes the warning away as soon as someone else joins', () => {
            const { store } = mount();
            fire('room-idle-warning', { secondsLeft: 60 });
            expect(screen.getByRole('alert')).toBeInTheDocument();

            act(() => { store.dispatch(setParticipants([{ socketId: 'a' }, { socketId: 'b' }])); });

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('falls back to a full minute if the server sends no number', () => {
            mount();

            fire('room-idle-warning', {});

            expect(screen.getByRole('alert')).toHaveTextContent('1:00');
        });
    });

    describe('chat', () => {
        it('starts closed, and counts messages that arrive while it is closed', () => {
            mount();
            expect(screen.getByTestId('chat')).toHaveAttribute('data-open', 'false');

            fireEvent.click(screen.getByText('new message'));
            fireEvent.click(screen.getByText('new message'));

            expect(screen.getByTestId('unread')).toHaveTextContent('2');
        });

        it('clears the unread count when opened', () => {
            mount();
            fireEvent.click(screen.getByText('new message'));

            fireEvent.click(screen.getByText('chat'));

            expect(screen.getByTestId('chat')).toHaveAttribute('data-open', 'true');
            expect(screen.getByTestId('unread')).toHaveTextContent('0');
        });

        it('closes again', () => {
            mount();
            fireEvent.click(screen.getByText('chat'));

            fireEvent.click(screen.getByText('chat'));

            expect(screen.getByTestId('chat')).toHaveAttribute('data-open', 'false');
        });
    });

    it('stops reacting to events once it is gone', () => {
        const { unmount } = mount();
        unmount();
        toast.error.mockClear();

        fire('removed-from-room');

        expect(toast.error).not.toHaveBeenCalled();
    });
});
