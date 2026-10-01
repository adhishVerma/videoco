import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { Video } from './Video';
import { makeVideoTrack, makeAudioTrack } from '../../test-utils';

const streamOf = (...tracks) => new MediaStream(tracks);

// the tile starts playback in an effect and updates state when play() settles;
// rendering inside an async act() lets that settle before the test looks
const renderTile = async (ui) => {
    let result;
    await act(async () => { result = render(ui); });
    return result;
};

describe('Video tile', () => {
    let play;

    beforeEach(() => {
        play = jest.fn(() => Promise.resolve());
        window.HTMLMediaElement.prototype.play = play;
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const getVideo = (container) => container.querySelector('video');

    it('plays the stream it is given through a native video element', async () => {
        const stream = streamOf(makeVideoTrack());
        const { container } = await renderTile(<Video stream={stream} name="Alice" />);

        expect(getVideo(container).srcObject).toBe(stream);
        expect(play).toHaveBeenCalled();
    });

    it('shows the person\'s initial instead of a black box when there is no video', async () => {
        await renderTile(<Video stream={streamOf(makeAudioTrack())} name="alice" />);

        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('shows the avatar before any stream exists', async () => {
        await renderTile(<Video stream={null} name="Bob" />);

        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('hides the avatar while a live video track is playing', async () => {
        await renderTile(<Video stream={streamOf(makeVideoTrack())} name="Alice" />);

        expect(screen.queryByText('A')).not.toBeInTheDocument();
    });

    it('brings the avatar back when the camera is turned off (track disabled, no event fired)', async () => {
        const track = makeVideoTrack();
        await renderTile(<Video stream={streamOf(track)} name="Alice" />);
        expect(screen.queryByText('A')).not.toBeInTheDocument();

        track.enabled = false;
        await act(async () => { jest.advanceTimersByTime(600); });

        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('treats a track that has not delivered media yet as "no video"', async () => {
        await renderTile(<Video stream={streamOf(makeVideoTrack({ muted: true }))} name="Carol" />);

        expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('notices when LiveKit swaps a new track into the same stream object', async () => {
        const stream = streamOf(makeAudioTrack());
        await renderTile(<Video stream={stream} name="Dave" />);
        expect(screen.getByText('D')).toBeInTheDocument();

        stream.addTrack(makeVideoTrack());
        await act(async () => { jest.advanceTimersByTime(600); });

        expect(screen.queryByText('D')).not.toBeInTheDocument();
    });

    it('shows the avatar when told the camera is off, even if frames are still arriving', async () => {
        await renderTile(<Video stream={streamOf(makeVideoTrack())} name="alice" cameraOff />);

        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('labels your own tile and mirrors it', async () => {
        const { container } = await renderTile(<Video stream={streamOf(makeVideoTrack())} name="Alice" isLocal muted />);

        expect(screen.getByText('Alice (You)')).toBeInTheDocument();
        expect(getVideo(container).className).toMatch(/-scale-x-100/);
    });

    it('does not mirror other people', async () => {
        const { container } = await renderTile(<Video stream={streamOf(makeVideoTrack())} name="Bob" />);

        expect(getVideo(container).className).not.toMatch(/-scale-x-100/);
    });

    it('falls back to "Guest" for an unnamed participant', async () => {
        await renderTile(<Video stream={null} />);

        expect(screen.getByText('Guest')).toBeInTheDocument();
    });

    it('keeps the muted state in sync after the first render', async () => {
        const stream = streamOf(makeVideoTrack());
        const { container, rerender } = await renderTile(<Video stream={stream} muted />);
        expect(getVideo(container).muted).toBe(true);

        await act(async () => { rerender(<Video stream={stream} muted={false} />); });

        expect(getVideo(container).muted).toBe(false);
    });

    it('shows a live caption', async () => {
        await renderTile(<Video stream={null} name="A" caption="hello everyone" />);

        expect(screen.getByText('hello everyone')).toBeInTheDocument();
    });

    describe('host controls', () => {
        it('offers no remove button unless asked to', async () => {
            await renderTile(<Video stream={null} name="A" />);

            expect(screen.queryByTitle('Remove from call')).not.toBeInTheDocument();
        });

        it('removes a participant without also toggling focus', async () => {
            const onRemove = jest.fn();
            const onToggleExpand = jest.fn();
            await renderTile(<Video stream={null} name="A" onRemove={onRemove} onToggleExpand={onToggleExpand} />);

            fireEvent.click(screen.getByTitle('Remove from call'));

            expect(onRemove).toHaveBeenCalledTimes(1);
            expect(onToggleExpand).not.toHaveBeenCalled();
        });

        it('lets you focus a tile and go back to everyone', async () => {
            const onToggleExpand = jest.fn();
            const { rerender } = await renderTile(<Video stream={null} name="A" onToggleExpand={onToggleExpand} />);

            fireEvent.click(screen.getByTitle('Focus on this person'));
            expect(onToggleExpand).toHaveBeenCalledTimes(1);

            await act(async () => { rerender(<Video stream={null} name="A" expanded onToggleExpand={onToggleExpand} />); });
            expect(screen.getByTitle('Show everyone')).toBeInTheDocument();
        });

        it('also focuses on double-click', async () => {
            const onToggleExpand = jest.fn();
            await renderTile(<Video stream={null} name="A" onToggleExpand={onToggleExpand} />);

            fireEvent.doubleClick(screen.getByTestId('video-tile'));

            expect(onToggleExpand).toHaveBeenCalledTimes(1);
        });
    });

    describe('when the browser blocks autoplay', () => {
        it('says so and lets the user start playback with a click', async () => {
            play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
            await renderTile(<Video stream={streamOf(makeVideoTrack())} name="A" />);

            const button = screen.getByText('Click to start playback');
            await act(async () => { fireEvent.click(button.closest('button')); });

            expect(play).toHaveBeenCalledTimes(2);
            expect(screen.queryByText('Click to start playback')).not.toBeInTheDocument();
        });
    });
});
