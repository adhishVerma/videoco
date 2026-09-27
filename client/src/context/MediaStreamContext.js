import React, { createContext } from "react";
import { useContext } from "react";
import * as webRTCHandler from '../utils/webRTCHandler';
import * as captionsUtil from '../utils/captions';
import * as livekitHandler from '../utils/livekitHandler';
import { socket, sendCaption } from '../utils/wss';
export const MediaStreamContext = createContext();

export const useMedia = () => {
  return useContext(MediaStreamContext);
};

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

  React.useEffect(() => {
    const handleReceiveCaption = ({ text, socketId }) => {
      setCaptions((prev) => ({ ...prev, [socketId]: text }));
    };

    socket.on('receive-caption', handleReceiveCaption);
    return () => socket.off('receive-caption', handleReceiveCaption);
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

      setCaptions((prev) => ({ ...prev, [socket.id]: text }));
      if (finalTranscript) {
        sendCaption(finalTranscript);
      }
    });
    setCaptionsEnabled(true);
  };

  const closeStream = () => {
    localStream.getTracks().forEach((track) => {
      track.stop();
    })
    captionsUtil.stopCaptioning();
    livekitHandler.disconnectLiveKitRoom();
  }

  const toggleAudio = () => {
    const enabled = micMuted ? false : true;
    localStream.getAudioTracks()[0].enabled = enabled;
    if (livekitHandler.isUsingLiveKit()) {
      livekitHandler.setLiveKitMicEnabled(enabled);
    }
  }

  const toggleVideo = () => {
    const enabled = videoOpen ? true : false;
    localStream.getVideoTracks()[0].enabled = enabled;
    if (livekitHandler.isUsingLiveKit()) {
      livekitHandler.setLiveKitCameraEnabled(enabled);
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
        captionsSupported: captionsUtil.isSpeechRecognitionSupported()
      }}
    >
      {props.children}
    </MediaStreamContext.Provider>
  );
};
