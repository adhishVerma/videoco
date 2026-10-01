import React from 'react';
import { screen } from '@testing-library/react';
import JoinRequest from './JoinRequest';
import { renderWithStore } from '../../test-utils';

jest.mock('./JoinRoomContent', () => () => <div data-testid="content" />);

describe('JoinRequest page', () => {
    it('is the "start a call" page for ?host', () => {
        const { store } = renderWithStore(<JoinRequest />, { route: '/join-room?host=true' });

        expect(store.getState().isRoomHost).toBe(true);
        expect(screen.getByRole('heading', { name: /start a call/i })).toBeInTheDocument();
    });

    it('is the "join a call" page otherwise', () => {
        renderWithStore(<JoinRequest />, { route: '/join-room' });

        expect(screen.getByRole('heading', { name: /join a call/i })).toBeInTheDocument();
    });

    it('stops acting as host when opened from an invite link (it used to stay on from an earlier call)', () => {
        const { store } = renderWithStore(<JoinRequest />, { route: '/join-room?room=abc', state: { isRoomHost: true } });

        expect(store.getState().isRoomHost).toBe(false);
    });
});
