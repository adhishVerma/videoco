import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MediaStreamProvider, useMedia, CAPTION_LINGER_MS } from './MediaStreamContext';
import * as webRTCHandler from '../utils/webRTCHandler';
import * as captionsUtil from '../utils/captions';
import * as livekitHandler from '../utils/livekitHandler';
import { sendCaption, connectWithSocketIOServer } from '../utils/wss';
import { makeVideoTrack, makeAudioTrack } from '../test-utils';

jest.mock('../utils/webRTCHandler', () => ({ leaveCall: jest.fn(), switchVideoTracks: jest.fn(), setLocalVideoEnabled: jest.fn() }));
jest.mock('../utils/captions', () => ({
    isSpeechRecognitionSupported: jest.fn(() => true),
    startCaptioning: jest.fn(),
    stopCaptioning: jest.fn(),
}));
jest.mock('../utils/livekitHandler', () => ({
    isUsingLiveKit: jest.fn(() => false),
    setLiveKitMicEnabled: jest.fn(),
    setLiveKitCameraEnabled: jest.fn(),
}));
jest.mock('../utils/wss', () => {
    const socket = { id: 'my-socket', on: jest.fn(), off: jest.fn(), __handlers: {} };
    return {
        socket,
        connectWithSocketIOServer: jest.fn(),
        sendCaption: jest.fn(),
    };
});

const { socket } = require('../utils/wss');

const setup = () => renderHook(() => useMedia(), { wrapper: MediaStreamProvider });
const emit = (name, detail) => act(() => { window.dispatchEvent(new CustomEvent(name, { detail })); });

describe('MediaStreamProvider', () => {
    // CRA's jest config resets every mock's implementation before each test,
    // so the fakes are rebuilt here rather than in the mock factories
    beforeEach(() => {
        socket.__handlers = {};
        socket.on.mockImplementation((event, handler) => { socket.__handlers[event] = handler; });
        socket.off.mockImplementation((event) => { delete socket.__handlers[event]; });
        connectWithSocketIOServer.mockReturnValue(socket);
        livekitHandler.isUsingLiveKit.mockReturnValue(false);
        captionsUtil.isSpeechRecognitionSupported.mockReturnValue(true);
    });

    describe('leaving', () => {
        it('does not throw when there is no camera stream yet (a call stuck connecting must still be leavable)', () => {
            const { result } = setup();

            expect(() => act(() => result.current.closeStream())).not.toThrow();

            expect(webRTCHandler.leaveCall).toHaveBeenCalled();
            expect(captionsUtil.stopCaptioning).toHaveBeenCalled();
        });

        it('stops the camera and any screen share', () => {
            const { result } = setup();
            const camera = makeVideoTrack();
            const screen = makeVideoTrack();
            act(() => {
                result.current.setLocalStream(new MediaStream([camera]));
                result.current.setScreenSharingStream(new MediaStream([screen]));
            });

            act(() => result.current.closeStream());

            expect(camera.stop).toHaveBeenCalled();
            expect(screen.stop).toHaveBeenCalled();
        });

        it('resets the UI so the next call does not inherit this one', () => {
            const { result } = setup();
            act(() => {
                result.current.setMicMuted(true);
                result.current.setVideoOpen(false);
                result.current.setIsScreenSharingActive(true);
                result.current.setRemoteStreams([{ id: 'x' }]);
                result.current.setLocalStream(new MediaStream([makeVideoTrack()]));
            });

            act(() => result.current.closeStream());

            expect(result.current.micMuted).toBe(false);
            expect(result.current.videoOpen).toBe(true);
            expect(result.current.isScreenSharingActive).toBe(false);
            expect(result.current.remoteStreams).toEqual([]);
            expect(result.current.localStream).toBeNull();
            expect(result.current.callStatus).toEqual({ status: 'starting' });
        });
    });

    describe('microphone', () => {
        it('shows muted immediately and disables the real audio track (mesh)', async () => {
            const { result } = setup();
            const mic = makeAudioTrack();
            act(() => result.current.setLocalStream(new MediaStream([mic])));

            await act(async () => { await result.current.toggleAudio(true); });

            expect(result.current.micMuted).toBe(true);
            expect(mic.enabled).toBe(false);
        });

        it('re-enables it', async () => {
            const { result } = setup();
            const mic = makeAudioTrack({ enabled: false });
            act(() => result.current.setLocalStream(new MediaStream([mic])));

            await act(async () => { await result.current.toggleAudio(false); });

            expect(mic.enabled).toBe(true);
            expect(result.current.micMuted).toBe(false);
        });

        it('lets LiveKit own the track when it is the transport', async () => {
            livekitHandler.isUsingLiveKit.mockReturnValue(true);
            const { result } = setup();
            const mic = makeAudioTrack();
            act(() => result.current.setLocalStream(new MediaStream([mic])));

            await act(async () => { await result.current.toggleAudio(true); });

            expect(livekitHandler.setLiveKitMicEnabled).toHaveBeenCalledWith(false);
            expect(mic.enabled).toBe(true); // untouched: LiveKit handles it
        });

        it('undoes the button and reports the problem if LiveKit refuses', async () => {
            livekitHandler.isUsingLiveKit.mockReturnValue(true);
            livekitHandler.setLiveKitMicEnabled.mockRejectedValue(new Error('device gone'));
            const errors = [];
            const listener = (e) => errors.push(e.detail.error);
            window.addEventListener('media-access-error', listener);
            const { result } = setup();

            await act(async () => { await result.current.toggleAudio(true); });

            expect(result.current.micMuted).toBe(false);
            expect(errors[0].message).toBe('device gone');
            window.removeEventListener('media-access-error', listener);
        });

        it('undoes the button when there is no microphone to toggle', async () => {
            const { result } = setup();

            await act(async () => { await result.current.toggleAudio(true); });

            expect(result.current.micMuted).toBe(false);
        });
    });

    describe('camera', () => {
        it('turns the real video track off and on (mesh)', async () => {
            const { result } = setup();
            const cam = makeVideoTrack();
            act(() => result.current.setLocalStream(new MediaStream([cam])));

            await act(async () => { await result.current.toggleVideo(false); });
            expect(cam.enabled).toBe(false);
            expect(result.current.videoOpen).toBe(false);

            await act(async () => { await result.current.toggleVideo(true); });
            expect(cam.enabled).toBe(true);
            expect(result.current.videoOpen).toBe(true);
        });

        it('tells the other side on the mesh, where a disabled track only sends black frames', async () => {
            const { result } = setup();
            act(() => result.current.setLocalStream(new MediaStream([makeVideoTrack()])));

            await act(async () => { await result.current.toggleVideo(false); });
            await act(async () => { await result.current.toggleVideo(true); });

            expect(webRTCHandler.setLocalVideoEnabled).toHaveBeenNthCalledWith(1, false);
            expect(webRTCHandler.setLocalVideoEnabled).toHaveBeenNthCalledWith(2, true);
        });

        it('goes through LiveKit when it is the transport (which signals mute itself)', async () => {
            livekitHandler.isUsingLiveKit.mockReturnValue(true);
            const { result } = setup();

            await act(async () => { await result.current.toggleVideo(false); });

            expect(livekitHandler.setLiveKitCameraEnabled).toHaveBeenCalledWith(false);
            expect(webRTCHandler.setLocalVideoEnabled).not.toHaveBeenCalled();
            expect(result.current.videoOpen).toBe(false);
        });

        it('undoes the button if the camera cannot be switched', async () => {
            livekitHandler.isUsingLiveKit.mockReturnValue(true);
            livekitHandler.setLiveKitCameraEnabled.mockRejectedValue(new Error('busy'));
            const { result } = setup();

            await act(async () => { await result.current.toggleVideo(false); });

            expect(result.current.videoOpen).toBe(true);
        });

        it('undoes the button in an audio-only call that has no camera', async () => {
            const { result } = setup();
            act(() => result.current.setLocalStream(new MediaStream([makeAudioTrack()])));

            await act(async () => { await result.current.toggleVideo(true); });

            expect(result.current.videoOpen).toBe(true); // was true; stays consistent with reality
        });
    });

    describe('call status', () => {
        it('follows the status the call flow announces', () => {
            const { result } = setup();

            emit('call-status', { status: 'connecting' });
            expect(result.current.callStatus).toEqual({ status: 'connecting' });

            emit('call-status', { status: 'failed', kind: 'media' });
            expect(result.current.callStatus).toEqual({ status: 'failed', kind: 'media' });
        });

        it('stops showing screen sharing when the browser ends it', () => {
            const { result } = setup();
            act(() => result.current.setIsScreenSharingActive(true));

            emit('screen-share-ended');

            expect(result.current.isScreenSharingActive).toBe(false);
        });
    });

    describe('screen sharing on the mesh', () => {
        it('switches peers to the shared screen, and back to the camera', () => {
            const { result } = setup();
            const camera = new MediaStream([makeVideoTrack()]);
            const screen = new MediaStream([makeVideoTrack()]);
            act(() => result.current.setLocalStream(camera));

            act(() => result.current.toggleScreenShare(false, screen));
            expect(webRTCHandler.switchVideoTracks).toHaveBeenLastCalledWith(screen);

            act(() => result.current.toggleScreenShare(true));
            expect(webRTCHandler.switchVideoTracks).toHaveBeenLastCalledWith(camera);
        });

        it('leaves it to LiveKit when LiveKit is the transport', () => {
            livekitHandler.isUsingLiveKit.mockReturnValue(true);
            const { result } = setup();

            act(() => result.current.toggleScreenShare(false, new MediaStream()));

            expect(webRTCHandler.switchVideoTracks).not.toHaveBeenCalled();
        });
    });

    describe('captions', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        const receive = (text, socketId = 'peer') => act(() => socket.__handlers['receive-caption']({ text, socketId }));

        it('registers on the (always-created) socket', () => {
            setup();

            expect(connectWithSocketIOServer).toHaveBeenCalled();
            expect(socket.on).toHaveBeenCalledWith('receive-caption', expect.any(Function));
        });

        it('shows what someone says, then clears it once they stop talking', () => {
            const { result } = setup();

            receive('hello there');
            expect(result.current.captions).toEqual({ peer: 'hello there' });

            act(() => { jest.advanceTimersByTime(CAPTION_LINGER_MS); });

            expect(result.current.captions).toEqual({});
        });

        it('keeps the line up while they keep talking', () => {
            const { result } = setup();
            receive('first');
            act(() => { jest.advanceTimersByTime(CAPTION_LINGER_MS - 1000); });

            receive('second');
            act(() => { jest.advanceTimersByTime(CAPTION_LINGER_MS - 1000); });

            expect(result.current.captions).toEqual({ peer: 'second' });
        });

        it('tracks each speaker separately', () => {
            const { result } = setup();

            receive('from a', 'a');
            act(() => { jest.advanceTimersByTime(CAPTION_LINGER_MS - 500); });
            receive('from b', 'b');
            act(() => { jest.advanceTimersByTime(500); });

            expect(result.current.captions).toEqual({ b: 'from b' });
        });

        it('stops listening and clears timers when unmounted', () => {
            const { unmount } = setup();
            receive('hi');

            unmount();

            expect(socket.off).toHaveBeenCalledWith('receive-caption', expect.any(Function));
            expect(jest.getTimerCount()).toBe(0);
        });

        it('does nothing where speech recognition is unsupported', () => {
            captionsUtil.isSpeechRecognitionSupported.mockReturnValue(false);
            const { result } = setup();

            act(() => result.current.toggleCaptions());

            expect(captionsUtil.startCaptioning).not.toHaveBeenCalled();
            expect(result.current.captionsEnabled).toBe(false);
        });

        it('shows your own words immediately and shares only finished sentences', () => {
            const { result } = setup();
            act(() => result.current.toggleCaptions());
            expect(result.current.captionsEnabled).toBe(true);
            const onResult = captionsUtil.startCaptioning.mock.calls[0][0];

            act(() => onResult({ interimTranscript: 'hel', finalTranscript: '' }));
            expect(result.current.captions['my-socket']).toBe('hel');
            expect(sendCaption).not.toHaveBeenCalled();

            act(() => onResult({ interimTranscript: '', finalTranscript: 'hello world' }));
            expect(sendCaption).toHaveBeenCalledWith('hello world');
        });

        it('ignores empty results', () => {
            const { result } = setup();
            act(() => result.current.toggleCaptions());
            const onResult = captionsUtil.startCaptioning.mock.calls[0][0];

            act(() => onResult({ interimTranscript: '', finalTranscript: '' }));

            expect(result.current.captions).toEqual({});
        });

        it('stops captioning and removes your own line when switched off', () => {
            const { result } = setup();
            act(() => result.current.toggleCaptions());
            const onResult = captionsUtil.startCaptioning.mock.calls[0][0];
            act(() => onResult({ interimTranscript: 'hi', finalTranscript: '' }));

            act(() => result.current.toggleCaptions());

            expect(captionsUtil.stopCaptioning).toHaveBeenCalled();
            expect(result.current.captionsEnabled).toBe(false);
            expect(result.current.captions['my-socket']).toBeUndefined();
        });
    });
});
