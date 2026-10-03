import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { makeVideoTrack } from '../../test-utils';

jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
jest.mock('../../context/MediaStreamContext', () => ({ useMedia: jest.fn() }));
jest.mock('../../utils/livekitHandler', () => ({
    isUsingLiveKit: jest.fn(),
    setLiveKitScreenShareEnabled: jest.fn(),
}));

// the module reads getDisplayMedia support once at import time
const loadButton = (supported = true) => {
    jest.resetModules();
    Object.defineProperty(navigator, 'mediaDevices', {
        value: supported ? { getDisplayMedia: jest.fn() } : {},
        configurable: true,
    });
    // eslint-disable-next-line global-require
    return require('./ScreenSharingButton').ScreenSharingButton;
};

describe('ScreenSharingButton', () => {
    let media;
    let useMediaMock;
    let livekit;
    let toastMock;

    const setup = (overrides = {}, supported = true) => {
        const ScreenSharingButton = loadButton(supported);
        // resetModules gave this test fresh copies of every mocked module
        // eslint-disable-next-line global-require
        useMediaMock = require('../../context/MediaStreamContext').useMedia;
        // eslint-disable-next-line global-require
        livekit = require('../../utils/livekitHandler');
        // eslint-disable-next-line global-require
        toastMock = require('react-toastify').toast;
        media = {
            screenSharingStream: null,
            setScreenSharingStream: jest.fn(),
            isScreenSharingActive: false,
            setIsScreenSharingActive: jest.fn(),
            toggleScreenShare: jest.fn(),
            ...overrides,
        };
        useMediaMock.mockReturnValue(media);
        livekit.isUsingLiveKit.mockReturnValue(false);
        return render(<ScreenSharingButton />);
    };

    it('is hidden where the browser cannot share a screen', () => {
        const { container } = setup({}, false);

        expect(container).toBeEmptyDOMElement();
    });

    it('is disabled when asked to be', () => {
        const ScreenSharingButton = loadButton(true);
        // eslint-disable-next-line global-require
        require('../../context/MediaStreamContext').useMedia.mockReturnValue({ isScreenSharingActive: false });
        render(<ScreenSharingButton disabled />);

        expect(screen.getByTitle('Share your screen')).toBeDisabled();
    });

    describe('with LiveKit', () => {
        it('shares through LiveKit and shows it as active', async () => {
            setup();
            livekit.isUsingLiveKit.mockReturnValue(true);

            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            expect(livekit.setLiveKitScreenShareEnabled).toHaveBeenCalledWith(true);
            expect(media.setIsScreenSharingActive).toHaveBeenCalledWith(true);
        });

        it('stops sharing', async () => {
            setup({ isScreenSharingActive: true });
            livekit.isUsingLiveKit.mockReturnValue(true);

            await act(async () => { fireEvent.click(screen.getByTitle('Stop sharing your screen')); });

            expect(livekit.setLiveKitScreenShareEnabled).toHaveBeenCalledWith(false);
            expect(media.setIsScreenSharingActive).toHaveBeenCalledWith(false);
        });

        it('says nothing when the user cancels the picker', async () => {
            setup();
            livekit.isUsingLiveKit.mockReturnValue(true);
            livekit.setLiveKitScreenShareEnabled.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }));

            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            expect(toastMock.error).not.toHaveBeenCalled();
            expect(media.setIsScreenSharingActive).not.toHaveBeenCalled();
        });

        it('reports a real failure, and does not claim to be sharing', async () => {
            setup();
            livekit.isUsingLiveKit.mockReturnValue(true);
            livekit.setLiveKitScreenShareEnabled.mockRejectedValue(new Error('encoder failed'));
            jest.spyOn(console, 'log').mockImplementation(() => {});

            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            expect(toastMock.error).toHaveBeenCalled();
            expect(media.setIsScreenSharingActive).not.toHaveBeenCalled();
            console.log.mockRestore();
        });
    });

    describe('on the mesh', () => {
        it('captures the screen and switches peers to it', async () => {
            setup();
            const screenStream = new MediaStream([makeVideoTrack()]);
            screenStream.getVideoTracks()[0].addEventListener = jest.fn();
            navigator.mediaDevices.getDisplayMedia.mockResolvedValue(screenStream);

            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            expect(media.setScreenSharingStream).toHaveBeenCalledWith(screenStream);
            expect(media.toggleScreenShare).toHaveBeenCalledWith(false, screenStream);
            expect(media.setIsScreenSharingActive).toHaveBeenCalledWith(true);
        });

        it('switches back when the browser\'s own "stop sharing" ends the track', async () => {
            setup();
            const track = makeVideoTrack();
            let onEnded;
            track.addEventListener = jest.fn((event, cb) => { onEnded = cb; });
            const screenStream = new MediaStream([track]);
            navigator.mediaDevices.getDisplayMedia.mockResolvedValue(screenStream);
            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            act(() => onEnded());

            expect(media.toggleScreenShare).toHaveBeenLastCalledWith(true);
            expect(media.setIsScreenSharingActive).toHaveBeenLastCalledWith(false);
            expect(track.stop).toHaveBeenCalled();
        });

        it('stops sharing from the button, releasing the capture', async () => {
            const track = makeVideoTrack();
            const stream = new MediaStream([track]);
            setup({ isScreenSharingActive: true, screenSharingStream: stream });

            await act(async () => { fireEvent.click(screen.getByTitle('Stop sharing your screen')); });

            expect(media.toggleScreenShare).toHaveBeenCalledWith(true);
            expect(track.stop).toHaveBeenCalled();
            expect(media.setScreenSharingStream).toHaveBeenCalledWith(null);
            expect(media.setIsScreenSharingActive).toHaveBeenCalledWith(false);
        });

        it('recovers when it thinks it is sharing but has no stream', async () => {
            setup({ isScreenSharingActive: true, screenSharingStream: null });

            await act(async () => { fireEvent.click(screen.getByTitle('Stop sharing your screen')); });

            expect(media.setIsScreenSharingActive).toHaveBeenCalledWith(false);
        });

        it('stays quiet when the user cancels the picker', async () => {
            setup();
            navigator.mediaDevices.getDisplayMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));

            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            expect(toastMock.error).not.toHaveBeenCalled();
            expect(media.setScreenSharingStream).not.toHaveBeenCalled();
        });

        it('reports a capture that really failed', async () => {
            setup();
            navigator.mediaDevices.getDisplayMedia.mockRejectedValue(new Error('no source'));
            jest.spyOn(console, 'log').mockImplementation(() => {});

            await act(async () => { fireEvent.click(screen.getByTitle('Share your screen')); });

            expect(toastMock.error).toHaveBeenCalled();
            console.log.mockRestore();
        });
    });
});
