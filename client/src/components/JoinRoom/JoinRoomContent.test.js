import React from 'react';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import JoinRoomContent from './JoinRoomContent';
import { getRoomExists } from '../../utils/api';
import { renderWithStore } from '../../test-utils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));
jest.mock('../../utils/api', () => ({ getRoomExists: jest.fn() }));

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /start call|join call|checking/i })); });

describe('JoinRoomContent', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('starting a call (host)', () => {
        const setup = () => renderWithStore(<JoinRoomContent />, { state: { isRoomHost: true, roomId: 'stale-room' } });

        it('asks for a name and an optional password, but not a room id', () => {
            setup();

            expect(screen.getByLabelText('Your name')).toBeInTheDocument();
            expect(screen.getByLabelText(/room password \(optional\)/i)).toBeInTheDocument();
            expect(screen.queryByLabelText('Room ID')).not.toBeInTheDocument();
        });

        it('will not start without a name', async () => {
            setup();

            await submit();

            expect(screen.getByText(/enter a name/i)).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('treats a name of only spaces as no name', async () => {
            setup();
            type('Your name', '    ');

            await submit();

            expect(screen.getByText(/enter a name/i)).toBeInTheDocument();
        });

        it('stores the details, forgets any old room, and opens the call', async () => {
            const { store } = setup();
            type('Your name', '  Alice  ');
            type(/room password/i, 'secret');

            await submit();

            expect(store.getState()).toMatchObject({ identity: 'Alice', roomPassword: 'secret', roomId: null });
            expect(mockNavigate).toHaveBeenCalledWith('/room');
            expect(getRoomExists).not.toHaveBeenCalled();
        });

        it('submits with the Enter key', async () => {
            setup();
            type('Your name', 'Alice');

            await act(async () => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });

            expect(mockNavigate).toHaveBeenCalledWith('/room');
        });

        it('limits the name length to what the server accepts', () => {
            setup();

            expect(screen.getByLabelText('Your name')).toHaveAttribute('maxLength', '50');
        });
    });

    describe('joining a call (guest)', () => {
        const setup = (route = '/join-room') => renderWithStore(<JoinRoomContent />, { state: { isRoomHost: false }, route });

        it('asks for a room id and a name', () => {
            setup();

            expect(screen.getByLabelText('Room ID')).toBeInTheDocument();
            expect(screen.getByLabelText('Your name')).toBeInTheDocument();
        });

        it('fills in the room from an invite link', () => {
            setup('/join-room?room=abc-123');

            expect(screen.getByLabelText('Room ID')).toHaveValue('abc-123');
        });

        it('asks for the missing pieces', async () => {
            setup();

            await submit();

            expect(screen.getByText(/room id is required/i)).toBeInTheDocument();
            expect(screen.getByText(/enter a name/i)).toBeInTheDocument();
            expect(getRoomExists).not.toHaveBeenCalled();
        });

        it('joins an open room', async () => {
            getRoomExists.mockResolvedValue({ roomExists: true, full: false, passwordProtected: false });
            const { store } = setup();
            type('Room ID', '  room-9  ');
            type('Your name', 'Bob');

            await submit();

            expect(getRoomExists).toHaveBeenCalledWith('room-9');
            expect(store.getState()).toMatchObject({ identity: 'Bob', roomId: 'room-9' });
            expect(mockNavigate).toHaveBeenCalledWith('/room');
        });

        it('says so when there is no such room', async () => {
            getRoomExists.mockResolvedValue({ roomExists: false });
            setup();
            type('Room ID', 'nope');
            type('Your name', 'Bob');

            await submit();

            expect(screen.getByText(/no room found/i)).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('says so when the room is full', async () => {
            getRoomExists.mockResolvedValue({ roomExists: true, full: true });
            setup();
            type('Room ID', 'busy');
            type('Your name', 'Bob');

            await submit();

            expect(screen.getByText(/room is full/i)).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('only asks for a password once it knows the room needs one', async () => {
            getRoomExists.mockResolvedValue({ roomExists: true, full: false, passwordProtected: true });
            setup();
            expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
            type('Room ID', 'locked');
            type('Your name', 'Bob');

            await submit();

            expect(screen.getByLabelText('Room password')).toBeInTheDocument();
            expect(screen.getByText(/password protected/i, { selector: 'p' })).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('proceeds once the password is supplied', async () => {
            getRoomExists.mockResolvedValue({ roomExists: true, full: false, passwordProtected: true });
            const { store } = setup();
            type('Room ID', 'locked');
            type('Your name', 'Bob');
            await submit();

            type('Room password', 'letmein');
            await submit();

            expect(store.getState().roomPassword).toBe('letmein');
            expect(mockNavigate).toHaveBeenCalledWith('/room');
        });

        it('explains a server that cannot be reached', async () => {
            getRoomExists.mockRejectedValue(new Error('network'));
            setup();
            type('Room ID', 'room');
            type('Your name', 'Bob');

            await submit();

            expect(screen.getByText(/couldn't reach the server/i)).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('shows it is working, and ignores a second click meanwhile', async () => {
            let finish;
            getRoomExists.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
            setup();
            type('Room ID', 'room');
            type('Your name', 'Bob');

            await submit();
            const busy = screen.getByRole('button', { name: /checking/i });
            expect(busy).toBeDisabled();
            fireEvent.click(busy);
            expect(getRoomExists).toHaveBeenCalledTimes(1);

            await act(async () => { finish({ roomExists: true, full: false }); });
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/room'));
        });

        it('lets the user try again after an error', async () => {
            getRoomExists.mockResolvedValueOnce({ roomExists: false });
            setup();
            type('Room ID', 'typo');
            type('Your name', 'Bob');
            await submit();

            getRoomExists.mockResolvedValueOnce({ roomExists: true, full: false });
            type('Room ID', 'right');
            await submit();

            expect(mockNavigate).toHaveBeenCalledWith('/room');
        });
    });

    describe('shared controls', () => {
        it('goes back home on cancel', () => {
            renderWithStore(<JoinRoomContent />, { state: { isRoomHost: true } });

            fireEvent.click(screen.getByText('Cancel'));

            expect(mockNavigate).toHaveBeenCalledWith('/');
        });

        it('records a camera-off join in the store', () => {
            const { store } = renderWithStore(<JoinRoomContent />, { state: { isRoomHost: true } });

            fireEvent.click(screen.getByLabelText(/camera off/i));

            expect(store.getState().connectOnlyAudio).toBe(true);
        });

        it('reflects the stored audio-only choice', () => {
            renderWithStore(<JoinRoomContent />, { state: { isRoomHost: true, connectOnlyAudio: true } });

            expect(screen.getByLabelText(/camera off/i)).toBeChecked();
        });
    });
});
