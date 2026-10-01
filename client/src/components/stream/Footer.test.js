import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Footer from './Footer';
import { useMedia } from '../../context/MediaStreamContext';

jest.mock('../../context/MediaStreamContext', () => ({ useMedia: jest.fn() }));
jest.mock('./ScreenSharingButton', () => ({
    ScreenSharingButton: ({ disabled }) => <button disabled={disabled}>screen share</button>,
}));

const baseMedia = () => ({
    mute: false,
    setMute: jest.fn(),
    micMuted: false,
    videoOpen: true,
    toggleAudio: jest.fn(),
    toggleVideo: jest.fn(),
    captionsEnabled: false,
    toggleCaptions: jest.fn(),
    captionsSupported: true,
    callStatus: { status: 'connected' },
});

const renderFooter = (media = {}, props = {}) => {
    const value = { ...baseMedia(), ...media };
    useMedia.mockReturnValue(value);
    const utils = render(<Footer chatToggle={jest.fn()} onLeave={jest.fn()} {...props} />);
    return { value, ...utils };
};

describe('Footer', () => {
    it('always offers a way to leave, even before the camera or connection exists', () => {
        const onLeave = jest.fn();
        renderFooter({ callStatus: { status: 'starting' } }, { onLeave });

        fireEvent.click(screen.getByTitle('Leave call'));

        expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('disables the controls that need a live call until it is connected', () => {
        renderFooter({ callStatus: { status: 'connecting' } });

        expect(screen.getByTitle('Mute microphone')).toBeDisabled();
        expect(screen.getByTitle('Turn off camera')).toBeDisabled();
        expect(screen.getByText('screen share')).toBeDisabled();
        expect(screen.getByTitle('Leave call')).toBeEnabled();
        expect(screen.getByTitle('Chat')).toBeEnabled();
    });

    it('enables them once connected, and keeps them available while reconnecting', () => {
        const { unmount } = renderFooter({ callStatus: { status: 'connected' } });
        expect(screen.getByTitle('Mute microphone')).toBeEnabled();
        unmount();

        renderFooter({ callStatus: { status: 'reconnecting' } });
        expect(screen.getByTitle('Mute microphone')).toBeEnabled();
    });

    it('stays disabled after a failed attempt', () => {
        renderFooter({ callStatus: { status: 'failed', kind: 'connection' } });

        expect(screen.getByTitle('Mute microphone')).toBeDisabled();
    });

    it('toggles the microphone to the opposite of its current state', () => {
        const { value } = renderFooter({ micMuted: false });

        fireEvent.click(screen.getByTitle('Mute microphone'));

        expect(value.toggleAudio).toHaveBeenCalledWith(true);
    });

    it('shows a muted microphone as muted, and offers to unmute it', () => {
        const { value } = renderFooter({ micMuted: true });

        const button = screen.getByTitle('Unmute microphone');
        expect(button).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(button);
        expect(value.toggleAudio).toHaveBeenCalledWith(false);
    });

    it('toggles the camera', () => {
        const { value } = renderFooter({ videoOpen: true });
        fireEvent.click(screen.getByTitle('Turn off camera'));
        expect(value.toggleVideo).toHaveBeenCalledWith(false);
    });

    it('shows a switched-off camera as off, and offers to turn it on', () => {
        const { value } = renderFooter({ videoOpen: false });

        fireEvent.click(screen.getByTitle('Turn on camera'));

        expect(value.toggleVideo).toHaveBeenCalledWith(true);
    });

    it('toggles the speaker and captions', () => {
        const { value } = renderFooter({ mute: false });

        fireEvent.click(screen.getByTitle('Mute speaker'));
        fireEvent.click(screen.getByTitle('Turn on captions'));

        expect(value.setMute).toHaveBeenCalledWith(true);
        expect(value.toggleCaptions).toHaveBeenCalled();
    });

    it('hides the captions button where speech recognition is unsupported', () => {
        renderFooter({ captionsSupported: false });

        expect(screen.queryByTitle('Turn on captions')).not.toBeInTheDocument();
    });

    it('opens the chat', () => {
        const chatToggle = jest.fn();
        renderFooter({}, { chatToggle });

        fireEvent.click(screen.getByTitle('Chat'));

        expect(chatToggle).toHaveBeenCalled();
    });

    it('shows an unread badge, capped at 9+', () => {
        const { unmount } = renderFooter({}, { unreadCount: 3 });
        expect(screen.getByLabelText('3 unread messages')).toHaveTextContent('3');
        unmount();

        renderFooter({}, { unreadCount: 25 });
        expect(screen.getByLabelText('25 unread messages')).toHaveTextContent('9+');
    });

    it('shows no badge when there is nothing unread', () => {
        renderFooter({}, { unreadCount: 0 });

        expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument();
    });
});
