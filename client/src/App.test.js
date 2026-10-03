import React from 'react';
import { screen } from '@testing-library/react';
import App from './App';
import { renderWithStore } from './test-utils';
import { useMedia } from './context/MediaStreamContext';

jest.mock('./utils/wss', () => ({ connectWithSocketIOServer: jest.fn() }));
jest.mock('./context/MediaStreamContext', () => ({ useMedia: jest.fn() }));
jest.mock('./pages/Room', () => () => <div data-testid="room-page" />);
jest.mock('./components/JoinRoom/JoinRoomContent', () => () => <div data-testid="join-form" />);

describe('App routes', () => {
    beforeEach(() => useMedia.mockReturnValue({ resetCallUi: jest.fn() }));

    it('shows the landing page at /', () => {
        renderWithStore(<App />, { route: '/' });

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/just work/i);
    });

    it('shows the join form at /join-room', () => {
        renderWithStore(<App />, { route: '/join-room' });

        expect(screen.getByTestId('join-form')).toBeInTheDocument();
    });

    it('shows the call room at /room', () => {
        renderWithStore(<App />, { route: '/room' });

        expect(screen.getByTestId('room-page')).toBeInTheDocument();
    });

    it('connects to the server once on start', () => {
        // eslint-disable-next-line global-require
        const { connectWithSocketIOServer } = require('./utils/wss');
        connectWithSocketIOServer.mockClear();

        renderWithStore(<App />, { route: '/' });

        expect(connectWithSocketIOServer).toHaveBeenCalledTimes(1);
    });
});
