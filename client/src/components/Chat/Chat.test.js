import React from 'react';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import Chat from './Chat';
import { socket } from '../../utils/wss';
import * as api from '../../utils/api';
import { uploadAttachment } from '../../utils/attachments';
import { toast } from 'react-toastify';
import { renderWithStore } from '../../test-utils';

jest.mock('../../utils/wss', () => ({ socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn() } }));
jest.mock('../../utils/api', () => ({ getAttachmentsStatus: jest.fn() }));
jest.mock('../../utils/attachments', () => ({ uploadAttachment: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('uuid', () => {
    let n = 0;
    return { v4: () => `id-${(n += 1)}` };
});

const PARTICIPANTS = [
    { socketId: 'sock-a', identity: 'Alice' },
    { socketId: 'sock-b', identity: 'Bob' },
];

describe('Chat', () => {
    let handlers;
    let play;

    const setup = async (props = {}, { attachments = false, participants = PARTICIPANTS } = {}) => {
        api.getAttachmentsStatus.mockResolvedValue({ enabled: attachments });
        let utils;
        await act(async () => {
            utils = renderWithStore(<Chat onClose={jest.fn()} isOpen {...props} />, { state: { roomId: 'room-1', participants } });
        });
        return utils;
    };

    const receive = (payload) => act(() => handlers['receive-message'](payload));

    beforeEach(() => {
        handlers = {};
        socket.on.mockImplementation((event, handler) => { handlers[event] = handler; });
        play = jest.fn(() => Promise.resolve());
        window.Audio = jest.fn(() => ({ play, volume: 1 }));
        window.HTMLElement.prototype.scrollTo = jest.fn();
    });

    it('starts with a friendly empty state', async () => {
        await setup();

        expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });

    describe('sending', () => {
        it('sends a trimmed message to the room and shows it as yours', async () => {
            await setup();

            fireEvent.change(screen.getByLabelText('Message'), { target: { value: '  hello  ' } });
            fireEvent.click(screen.getByTitle('Send message'));

            expect(socket.emit).toHaveBeenCalledWith('send-message', { roomId: 'room-1', message: { message: 'hello', messageId: expect.any(String) } });
            expect(screen.getByText('hello')).toBeInTheDocument();
            expect(screen.getByLabelText('Message')).toHaveValue('');
        });

        it('sends on Enter', async () => {
            await setup();

            fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hi' } });
            fireEvent.submit(screen.getByLabelText('Message').closest('form'));

            expect(socket.emit).toHaveBeenCalledTimes(1);
        });

        it('will not send an empty or whitespace-only message', async () => {
            await setup();
            expect(screen.getByTitle('Send message')).toBeDisabled();

            fireEvent.change(screen.getByLabelText('Message'), { target: { value: '   ' } });
            fireEvent.submit(screen.getByLabelText('Message').closest('form'));

            expect(socket.emit).not.toHaveBeenCalled();
            expect(screen.getByLabelText('Message')).toHaveValue('');
        });

        it('limits message length to what the server accepts', async () => {
            await setup();

            expect(screen.getByLabelText('Message')).toHaveAttribute('maxLength', '2000');
        });
    });

    describe('receiving', () => {
        it('shows a message with the sender\'s name', async () => {
            await setup();

            receive({ message: 'hi there', messageId: 'm1', socketId: 'sock-a' });

            expect(screen.getByText('hi there')).toBeInTheDocument();
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        it('does not crash when the sender has already left (this used to blank the page)', async () => {
            await setup();

            expect(() => receive({ message: 'bye', messageId: 'm2', socketId: 'long-gone' })).not.toThrow();

            expect(screen.getByText('bye')).toBeInTheDocument();
            expect(screen.getByText('Someone')).toBeInTheDocument();
        });

        it('uses the latest participant list without re-subscribing for every message', async () => {
            const { store } = await setup();
            const subscriptions = socket.on.mock.calls.filter(([e]) => e === 'receive-message').length;

            receive({ message: 'one', messageId: 'm1', socketId: 'sock-a' });
            receive({ message: 'two', messageId: 'm2', socketId: 'sock-b' });

            expect(socket.on.mock.calls.filter(([e]) => e === 'receive-message')).toHaveLength(subscriptions);
            expect(store).toBeDefined();
            expect(screen.getByText('Bob')).toBeInTheDocument();
        });

        it('keeps messages in order', async () => {
            await setup();

            receive({ message: 'first', messageId: 'a', socketId: 'sock-a' });
            receive({ message: 'second', messageId: 'b', socketId: 'sock-a' });

            const text = screen.getByRole('log').textContent;
            expect(text.indexOf('first')).toBeLessThan(text.indexOf('second'));
        });

        it('plays a sound', async () => {
            await setup();

            receive({ message: 'ping', messageId: 'm', socketId: 'sock-a' });

            expect(play).toHaveBeenCalled();
        });

        it('copes with the browser refusing to play the sound', async () => {
            play.mockRejectedValue(new Error('autoplay blocked'));
            await setup();

            expect(() => receive({ message: 'ping', messageId: 'm', socketId: 'sock-a' })).not.toThrow();
        });

        it('copes with there being no audio support at all', async () => {
            window.Audio = jest.fn(() => { throw new Error('no audio'); });

            await setup();

            expect(() => receive({ message: 'ping', messageId: 'm', socketId: 'sock-a' })).not.toThrow();
        });

        it('shows a shared file', async () => {
            await setup();

            receive({ message: '', messageId: 'f', socketId: 'sock-a', attachment: { url: 'https://cdn.example.com/a.png', type: 'image/png', name: 'a.png' } });

            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example.com/a.png');
        });

        it('refuses to render a file link that could run script', async () => {
            await setup();

            receive({ message: 'look', messageId: 'x', socketId: 'sock-a', attachment: { url: 'javascript:alert(1)', type: 'application/zip', name: 'evil' } });

            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            expect(screen.getByText('look')).toBeInTheDocument();
        });

        it('stops listening when closed', async () => {
            const { unmount } = await setup();

            unmount();

            expect(socket.off).toHaveBeenCalledWith('receive-message', expect.any(Function));
        });
    });

    describe('unread messages', () => {
        it('reports a message that arrives while the chat is closed', async () => {
            const onUnread = jest.fn();
            await setup({ isOpen: false, onUnread });

            receive({ message: 'hey', messageId: 'm', socketId: 'sock-a' });

            expect(onUnread).toHaveBeenCalledTimes(1);
        });

        it('does not, while the chat is open', async () => {
            const onUnread = jest.fn();
            await setup({ isOpen: true, onUnread });

            receive({ message: 'hey', messageId: 'm', socketId: 'sock-a' });

            expect(onUnread).not.toHaveBeenCalled();
        });

        it('counts correctly after the chat is closed again (reads the live state, not the one from first render)', async () => {
            const onUnread = jest.fn();
            const { rerenderWithStore } = await setup({ isOpen: true, onUnread });

            await act(async () => { rerenderWithStore(<Chat onClose={jest.fn()} isOpen={false} onUnread={onUnread} />); });
            receive({ message: 'late', messageId: 'm', socketId: 'sock-a' });

            expect(onUnread).toHaveBeenCalled();
        });
    });

    describe('attachments', () => {
        const pick = (file) => fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });

        it('offers no attach button when the server has no storage configured', async () => {
            await setup({}, { attachments: false });

            expect(screen.queryByTitle('Attach a file')).not.toBeInTheDocument();
        });

        it('offers one when it does', async () => {
            await setup({}, { attachments: true });

            expect(screen.getByTitle('Attach a file')).toBeInTheDocument();
        });

        it('hides the button if the status check fails', async () => {
            api.getAttachmentsStatus.mockRejectedValue(new Error('down'));
            await act(async () => { renderWithStore(<Chat isOpen />, { state: { roomId: 'r', participants: [] } }); });

            expect(screen.queryByTitle('Attach a file')).not.toBeInTheDocument();
        });

        it('uploads the chosen file and shares it with the room', async () => {
            await setup({}, { attachments: true });
            const attachment = { url: 'https://cdn.example.com/a.png', type: 'image/png', name: 'a.png', size: 1 };
            uploadAttachment.mockResolvedValue(attachment);

            await act(async () => { pick(new File(['x'], 'a.png', { type: 'image/png' })); });

            expect(socket.emit).toHaveBeenCalledWith('send-message', { roomId: 'room-1', message: { message: '', messageId: expect.any(String), attachment } });
            expect(await screen.findByRole('img')).toBeInTheDocument();
        });

        it('says why an upload failed, and leaves the chat usable', async () => {
            await setup({}, { attachments: true });
            uploadAttachment.mockRejectedValue(new Error('File too large'));

            await act(async () => { pick(new File(['x'], 'big.bin')); });

            expect(toast.error).toHaveBeenCalledWith('File too large', expect.anything());
            await waitFor(() => expect(screen.getByLabelText('Message')).not.toBeDisabled());
        });

        it('prefers the server\'s own explanation when it gave one', async () => {
            await setup({}, { attachments: true });
            uploadAttachment.mockRejectedValue({ response: { data: { error: 'File type not allowed' } } });

            await act(async () => { pick(new File(['x'], 'a.exe')); });

            expect(toast.error).toHaveBeenCalledWith('File type not allowed', expect.anything());
        });

        it('locks the input while uploading', async () => {
            await setup({}, { attachments: true });
            let finish;
            uploadAttachment.mockReturnValue(new Promise((resolve) => { finish = resolve; }));

            await act(async () => { pick(new File(['x'], 'a.png')); });
            expect(screen.getByLabelText('Message')).toBeDisabled();
            expect(screen.getByPlaceholderText(/uploading/i)).toBeInTheDocument();

            await act(async () => { finish({ url: 'https://cdn.example.com/a.png', type: 'image/png', name: 'a.png' }); });
            expect(screen.getByLabelText('Message')).not.toBeDisabled();
        });

        it('ignores a cancelled file picker', async () => {
            await setup({}, { attachments: true });

            await act(async () => { fireEvent.change(screen.getByTestId('file-input'), { target: { files: [] } }); });

            expect(uploadAttachment).not.toHaveBeenCalled();
        });
    });

    it('can be closed', async () => {
        const onClose = jest.fn();
        await setup({ onClose });

        fireEvent.click(screen.getByTitle('Close chat'));

        expect(onClose).toHaveBeenCalled();
    });
});
