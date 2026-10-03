import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import Connect from './Connect';
import { useMedia } from '../context/MediaStreamContext';
import { renderWithStore } from '../test-utils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));
jest.mock('../context/MediaStreamContext', () => ({ useMedia: jest.fn() }));

describe('Connect (landing page)', () => {
    let resetCallUi;

    beforeEach(() => {
        jest.clearAllMocks();
        resetCallUi = jest.fn();
        useMedia.mockReturnValue({ resetCallUi });
    });

    it('explains the product', () => {
        renderWithStore(<Connect />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/video calls that just work/i);
        ['Screen sharing', 'Live captions', 'File sharing', 'Password-protected rooms'].forEach((feature) => {
            expect(screen.getByText(feature)).toBeInTheDocument();
        });
    });

    it('starts a call as host', () => {
        renderWithStore(<Connect />);

        fireEvent.click(screen.getByText('Start a call'));

        expect(mockNavigate).toHaveBeenCalledWith('/join-room?host=true');
    });

    it('joins a call as a guest', () => {
        renderWithStore(<Connect />);

        fireEvent.click(screen.getByText('Join a call'));

        expect(mockNavigate).toHaveBeenCalledWith('/join-room');
    });

    describe('arriving here after a call', () => {
        it('forgets the previous call entirely - including the room id the navbar was still showing', () => {
            const { store } = renderWithStore(<Connect />, {
                state: { roomId: 'old-room', isRoomHost: true, participants: [{ socketId: 'a' }] },
            });

            expect(store.getState()).toMatchObject({ roomId: null, isRoomHost: false, participants: [] });
            expect(resetCallUi).toHaveBeenCalled();
        });
    });
});
