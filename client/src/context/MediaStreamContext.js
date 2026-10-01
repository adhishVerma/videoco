import React, { createContext, useCallback, useEffect, useRef } from "react";
import { useContext } from "react";
import * as webRTCHandler from '../utils/webRTCHandler';
import * as captionsUtil from '../utils/captions';
import * as livekitHandler from '../utils/livekitHandler';
import { CALL_STATUS } from '../utils/callStatus';
import { connectWithSocketIOServer, socket, sendCaption } from '../utils/wss';
export const MediaStreamContext = createContext();

export const useMedia = () => {
  return useContext(MediaStreamContext);
};

// how long a line of live caption stays on screen after the last words
export const CAPTION_LINGER_MS = 4000;

export const MediaStreamProvider = (props) => {
  const [remoteStreams, setRemoteStreams] = React.useState([]);
  const [screenSharingStream, setScreenSharingStream] = React.useState(null);
  const [isScreenSharingActive, setIsScreenSharingActive] = React.useState(false);
  const [localStream, setLocalStream] = React.useState(null);
  const [mute, setMute] = React.useState(false);
  const [micMuted, setMicMuted] = React.useState(false);
  const [videoOpen, setVideoOpen] = React.useState(true);
  const [captionsEnabled, setCaptionsEnabled] = React.useState(false);
  const [captions, setCaptions] = React.useState({});
  const [callStatus, setCallStatusState] = React.useState({ status: CALL_STATUS.STARTING });
  const captionTimers = useRef({});

  // Captions used to stay on screen forever once someone stopped talking -
  // there was nothing that ever cleared the last line.
  const showCaption = useCallback((socketId, text) => {
    setCaptions((prev) => ({ ...prev, [socketId]: text }));
    clearTimeout(captionTimers.current[socketId]);
    captionTimers.current[socketId] = setTimeout(() => {
      setCaptions((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
      delete captionTimers.current[socketId];
    }, CAPTION_LINGER_MS);
  }, []);

  const clearCaptions = useCallback(() => {
    Object.values(captionTimers.current).forEach(clearTimeout);
    captionTimers.current = {};
    setCaptions({});
  }, []);

  useEffect(() => {
    const handleReceiveCaption = ({ text, socketId }) => showCaption(socketId, text);

    // idempotent: makes sure the socket exists no matter which effect ran first
    const activeSocket = connectWithSocketIOServer();
    activeSocket.on('receive-caption', handleReceiveCaption);
    return () => activeSocket.off('receive-caption', handleReceiveCaption);
  }, [showCaption]);

  useEffect(() => {
    const handleStatus = (event) => setCallStatusState(event.detail);
    // the browser's own "Stop sharing" bar ends a share without our button
    const handleScreenShareEnded = () => setIsScreenSharingActive(false);

    window.addEventListener('call-status', handleStatus);
    window.addEventListener('screen-share-ended', handleScreenShareEnded);
    return () => {
      window.removeEventListener('call-status', handleStatus);
      window.removeEventListener('screen-share-ended', handleScreenShareEnded);
    };
  }, []);

  useEffect(() => () => {
    Object.values(captionTimers.current).forEach(clearTimeout);
  }, []);

  const toggleCaptions = () => {
    if (captionsEnabled) {
      captionsUtil.stopCaptioning();
      setCaptionsEnabled(false);
      setCaptions((prev) => {
        const updated = { ...prev };
        delete updated[socket.id];
        return updated;
      });
      return;
    }

    if (!captionsUtil.isSpeechRecognitionSupported()) return;

    captionsUtil.startCaptioning(({ finalTranscript, interimTranscript }) => {
      const text = finalTranscript || interimTranscript;
      if (!text) return;

      showCaption(socket.id, text);
      if (finalTranscript) {
        sendCaption(finalTranscript);
      }
    });
    setCaptionsEnabled(true);
  };

  // Back to a clean slate for the next call. Without this, leaving with the
  // camera off and joining another room showed the camera button as "on"
  // while the camera was actually off, and old streams/captions lingered.
  const resetCallUi = useCallback(() => {
    setLocalStream(null);
    setRemoteStreams([]);
    setMicMuted(false);
    setVideoOpen(true);
    setIsScreenSharingActive(false);
    setScreenSharingStream(null);
    setCaptionsEnabled(false);
    clearCaptions();
    setCallStatusState({ status: CALL_STATUS.STARTING });
  }, [clearCaptions]);

  // Safe to call at any point of a call, including before the camera was
  // ever granted (localStream still null) - it used to throw there, which
  // made a call stuck on connecting impossible to leave.
  const closeStream = () => {
    captionsUtil.stopCaptioning();
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    if (screenSharingStream) screenSharingStream.getTracks().forEach((track) => track.stop());
    webRTCHandler.leaveCall();
    resetCallUi();
  }

  const reportMediaError = (err) => {
    window.dispatchEvent(new CustomEvent('media-access-error', { detail: { error: err } }));
  };

  // Takes the target state explicitly rather than deriving it from
  // micMuted/videoOpen - reading those here raced the setState call that
  // updates them, so the track's actual enabled state was always one
  // toggle behind what the button showed. The button updates immediately
  // and rolls back if the change doesn't actually go through.
  const toggleAudio = async (nextMicMuted) => {
    const previous = micMuted;
    const enabled = !nextMicMuted;
    setMicMuted(nextMicMuted);
    try {
      // LiveKit owns the published track's lifecycle (it may stop/replace it
      // outright) - toggling the raw track here would fight that, and on the
      // mesh path there's no LiveKit track to manage at all.
      if (livekitHandler.isUsingLiveKit()) {
        await livekitHandler.setLiveKitMicEnabled(enabled);
      } else {
        const track = localStream && localStream.getAudioTracks()[0];
        if (!track) throw new Error('No microphone available');
        track.enabled = enabled;
      }
    } catch (err) {
      setMicMuted(previous);
      reportMediaError(err);
    }
  }

  const toggleVideo = async (nextVideoOpen) => {
    const previous = videoOpen;
    setVideoOpen(nextVideoOpen);
    try {
      if (livekitHandler.isUsingLiveKit()) {
        await livekitHandler.setLiveKitCameraEnabled(nextVideoOpen);
      } else {
        const track = localStream && localStream.getVideoTracks()[0];
        if (!track) throw new Error('No camera available');
        track.enabled = nextVideoOpen;
        webRTCHandler.setLocalVideoEnabled(nextVideoOpen);
      }
    } catch (err) {
      setVideoOpen(previous);
      reportMediaError(err);
    }
  }

  const toggleScreenShare = (
    isScreenSharingActive,
    screenSharingStream = null
  ) => {
    // LiveKit's own screen-share toggle (called directly from
    // ScreenSharingButton) handles capture + publish itself.
    if (livekitHandler.isUsingLiveKit()) return;

    if (isScreenSharingActive) {
      webRTCHandler.switchVideoTracks(localStream);
    } else {
      webRTCHandler.switchVideoTracks(screenSharingStream);
    }
  };

  return (
    <MediaStreamContext.Provider
      value={{
        remoteStreams,
        setRemoteStreams,
        localStream,
        setLocalStream,
        mute,
        setMute,
        videoOpen, setVideoOpen,
        micMuted, setMicMuted,
        closeStream,
        resetCallUi,
        toggleAudio,
        toggleVideo,
        screenSharingStream,
        setScreenSharingStream,
        isScreenSharingActive,
        setIsScreenSharingActive,
        toggleScreenShare,
        captionsEnabled,
        captions,
        toggleCaptions,
        captionsSupported: captionsUtil.isSpeechRecognitionSupported(),
        callStatus,
      }}
    >
      {props.children}
    </MediaStreamContext.Provider>
  );
};
