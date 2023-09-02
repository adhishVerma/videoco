import React, { createContext } from "react";
import { useContext } from "react";
import * as webRTCHandler from '../utils/webRTCHandler';
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

  const closeStream = () => {
    localStream.getTracks().forEach((track) => {
      track.stop();
    })
  }

  const toggleAudio = () => {
    localStream.getAudioTracks()[0].enabled = micMuted ? false : true;
  }

  const toggleVideo = () => {
    localStream.getVideoTracks()[0].enabled = videoOpen ? true : false;
  }

  const toggleScreenShare = (
    isScreenSharingActive,
    screenSharingStream = null
  ) => {
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
        toggleScreenShare
      }}
    >
      {props.children}
    </MediaStreamContext.Provider>
  );
};
