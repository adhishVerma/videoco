import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import Navbar, { buildInviteLink } from './Navbar';
import { toast } from 'react-toastify';
import { renderWithStore } from '../test-utils';

jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), info: jest.fn() } }));

describe('Navbar', () => {
    let writeText;

    beforeEach(() => {
        jest.clearAllMocks();
        writeText = jest.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });

    it('links home', () => {
        renderWithStore(<Navbar />);

        expect(screen.getByLabelText('Videoco home')).toHaveAttribute('href', '/');
    });

    it('offers no invite link outside a call', () => {
        renderWithStore(<Navbar />, { route: '/', state: { roomId: 'old-room' } });

        expect(screen.queryByTitle('Copy invite link')).not.toBeInTheDocument();
    });

    it('offers no invite link in a call that has no room yet', () => {
        renderWithStore(<Navbar />, { route: '/room', state: { roomId: null } });

        expect(screen.queryByTitle('Copy invite link')).not.toBeInTheDocument();
    });

    it('copies a link that takes a guest straight to the right room', async () => {
        renderWithStore(<Navbar />, { route: '/room', state: { roomId: 'room-123' } });

        await act(async () => { fireEvent.click(screen.getByTitle('Copy invite link')); });

        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join-room?room=room-123`);
        expect(toast.success).toHaveBeenCalled();
    });

    it('shows the link to copy by hand when the clipboard is unavailable', async () => {
        writeText.mockRejectedValue(new Error('denied'));
        renderWithStore(<Navbar />, { route: '/room', state: { roomId: 'room-123' } });

        await act(async () => { fireEvent.click(screen.getByTitle('Copy invite link')); });

        expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('/join-room?room=room-123'), expect.anything());
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('is dark inside the call and light elsewhere', () => {
        const { unmount } = renderWithStore(<Navbar />, { route: '/room' });
        expect(screen.getByRole('banner').className).toMatch(/bg-room-bg/);
        unmount();

        renderWithStore(<Navbar />, { route: '/' });
        expect(screen.getByRole('banner').className).toMatch(/bg-white/);
    });

    it('escapes the room id in the invite link', () => {
        expect(buildInviteLink('a b&c')).toContain('room=a%20b%26c');
    });
});
