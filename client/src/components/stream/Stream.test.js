import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import Stream from './Stream';
import { useMedia } from '../../context/MediaStreamContext';
import { removeParticipant } from '../../utils/wss';
import { renderWithStore, makeVideoTrack } from '../../test-utils';

jest.mock('../../context/MediaStreamContext', () => ({ useMedia: jest.fn() }));
jest.mock('../../utils/wss', () => ({
    socket: { id: 'my-socket' },
    removeParticipant: jest.fn(),
}));

const stream = () => new MediaStream([makeVideoTrack()]);

describe('Stream', () => {
    let media;

    const setup = (mediaOverrides = {}, state = {}) => {
        media = {
            mute: false,
            localStream: stream(),
            setLocalStream: jest.fn(),
            remoteStreams: [],
            setRemoteStreams: jest.fn(),
            captions: {},
            callStatus: { status: 'connected' },
            ...mediaOverrides,
        };
        useMedia.mockReturnValue(media);
        return renderWithStore(<Stream />, {
            state: { identity: 'Me', participants: [], isRoomHost: false, ...state },
        });
    };

    beforeEach(() => {
        window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
        jest.clearAllMocks();
    });

    it('shows your own tile, labelled as you', () => {
        setup();

        expect(screen.getByText('Me (You)')).toBeInTheDocument();
    });

    it('shows a tile per remote participant, named from the participants list', () => {
        setup(
            { remoteStreams: [{ id: 'sock-a', stream: stream() }] },
            { participants: [{ socketId: 'sock-a', identity: 'Alice' }] },
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getAllByTestId('video-tile')).toHaveLength(2);
    });

    it('tells a lone participant nobody else is here', () => {
        setup();

        expect(screen.getByText(/only one here/i)).toBeInTheDocument();
    });

    it('does not say that while still connecting, or once someone has joined', () => {
        setup({ callStatus: { status: 'connecting' } });
        expect(screen.queryByText(/only one here/i)).not.toBeInTheDocument();
    });

    it('does not say that once someone has joined', () => {
        setup({ remoteStreams: [{ id: 'sock-a', stream: stream() }] });

        expect(screen.queryByText(/only one here/i)).not.toBeInTheDocument();
    });

    it('lets the host remove someone, but never offers to remove yourself', () => {
        setup(
            { remoteStreams: [{ id: 'sock-a', stream: stream() }] },
            { isRoomHost: true, participants: [{ socketId: 'sock-a', identity: 'Alice' }] },
        );

        const buttons = screen.getAllByTitle('Remove from call');
        expect(buttons).toHaveLength(1);
        fireEvent.click(buttons[0]);

        expect(removeParticipant).toHaveBeenCalledWith('sock-a');
    });

    it('offers guests no remove buttons', () => {
        setup({ remoteStreams: [{ id: 'sock-a', stream: stream() }] }, { isRoomHost: false });

        expect(screen.queryByTitle('Remove from call')).not.toBeInTheDocument();
    });

    it('shows each person\'s own caption', () => {
        setup(
            { remoteStreams: [{ id: 'sock-a', stream: stream() }], captions: { 'sock-a': 'hi from alice', 'my-socket': 'hi from me' } },
        );

        expect(screen.getByText('hi from alice')).toBeInTheDocument();
        expect(screen.getByText('hi from me')).toBeInTheDocument();
    });

    it('hands the local stream the call flow produces to the context', () => {
        setup();
        const newStream = stream();

        act(() => { window.dispatchEvent(new CustomEvent('catch-local-stream', { detail: { stream: newStream } })); });

        expect(media.setLocalStream).toHaveBeenCalledWith(newStream);
    });

    it('hands remote streams to the context', () => {
        setup();
        const streams = [{ id: 'x', stream: stream() }];

        act(() => { window.dispatchEvent(new CustomEvent('catch-remote-stream', { detail: { streams } })); });

        expect(media.setRemoteStreams).toHaveBeenCalledWith(streams);
    });

    describe('when a participant leaves', () => {
        const fireRemove = (socketId) => act(() => {
            window.dispatchEvent(new CustomEvent('remove-remote-stream', { detail: { socketId } }));
        });

        it('removes just that participant', () => {
            setup();

            fireRemove('b');

            const updater = media.setRemoteStreams.mock.calls[0][0];
            expect(updater([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual([{ id: 'a' }, { id: 'c' }]);
        });

        it('copes with someone who left before their video ever arrived (this used to crash the page)', () => {
            setup();

            expect(() => fireRemove('never-had-a-stream')).not.toThrow();

            const updater = media.setRemoteStreams.mock.calls[0][0];
            expect(updater([{ id: 'a' }])).toEqual([{ id: 'a' }]);
        });
    });

    describe("other people's cameras", () => {
        const withGuest = () => setup(
            { remoteStreams: [{ id: 'sock-a', stream: stream() }] },
            { participants: [{ socketId: 'sock-a', identity: 'Alice' }] },
        );
        const signal = (socketId, video) => act(() => {
            window.dispatchEvent(new CustomEvent('remote-media-state', { detail: { socketId, video } }));
        });
        const aliceTile = () => screen.getAllByTestId('video-tile').find((t) => t.textContent.includes('Alice'));

        it('shows an avatar when they say their camera is off, even though their stream still delivers frames', () => {
            withGuest();
            expect(aliceTile().querySelector('video').className).toMatch(/opacity-100/);

            signal('sock-a', false);

            expect(aliceTile().querySelector('video').className).not.toMatch(/opacity-100/);
        });

        it('shows their video again when they turn it back on', () => {
            withGuest();
            signal('sock-a', false);

            signal('sock-a', true);

            expect(aliceTile().querySelector('video').className).toMatch(/opacity-100/);
        });

        it('does not let one person\'s camera state affect anyone else', () => {
            withGuest();

            signal('someone-else', false);

            expect(aliceTile().querySelector('video').className).toMatch(/opacity-100/);
        });

        it('forgets the state of someone who left, so a returning person starts fresh', () => {
            withGuest();
            signal('sock-a', false);

            act(() => { window.dispatchEvent(new CustomEvent('remove-remote-stream', { detail: { socketId: 'sock-a' } })); });
            signal('sock-a', true);
            act(() => { window.dispatchEvent(new CustomEvent('remove-remote-stream', { detail: { socketId: 'sock-a' } })); });

            expect(() => signal('sock-a', true)).not.toThrow();
        });

        it('ignores a malformed message', () => {
            withGuest();

            expect(() => act(() => { window.dispatchEvent(new CustomEvent('remote-media-state', { detail: {} })); })).not.toThrow();
        });
    });

    describe('focusing on one person', () => {
        const withTwo = () => setup(
            { remoteStreams: [{ id: 'sock-a', stream: stream() }] },
            { participants: [{ socketId: 'sock-a', identity: 'Alice' }] },
        );

        it('offers focus controls only when there is someone else to switch between', () => {
            setup();

            expect(screen.queryByTitle('Focus on this person')).not.toBeInTheDocument();
        });

        it('enlarges the chosen tile and keeps everyone else visible', () => {
            withTwo();

            fireEvent.click(screen.getAllByTitle('Focus on this person')[0]);

            expect(screen.getAllByTestId('video-tile')).toHaveLength(2);
            expect(screen.getByTitle('Show everyone')).toBeInTheDocument();
        });

        it('goes back to the normal grid', () => {
            withTwo();
            fireEvent.click(screen.getAllByTitle('Focus on this person')[0]);

            fireEvent.click(screen.getByTitle('Show everyone'));

            expect(screen.queryByTitle('Show everyone')).not.toBeInTheDocument();
        });
    });
});
