import React, { createContext } from "react";
import { useContext } from "react";

export const MediaStreamContext = createContext();

export const useMedia = () => {
  return useContext(MediaStreamContext);
};

export const MediaStreamProvider = (props) => {
  const [remoteStream, setRemoteStream] = React.useState();
  const [localStream, setLocalStream] = React.useState();
  const [mute, setMute] = React.useState(false);
  const [micOpen, setMicOpen] = React.useState(false);
  const [videoOpen, setVideoOpen] = React.useState(false);

  const closeStream = () => {
    localStream.getTracks().forEach((track) => {
      track.stop();
    })
    setRemoteStream(null);
  }

  return (
    <MediaStreamContext.Provider
      value={{
        remoteStream,
        setRemoteStream,
        localStream,
        setLocalStream,
        mute,
        setMute,
        videoOpen, setVideoOpen,
        micOpen, setMicOpen,
        closeStream
      }}
    >
      {props.children}
    </MediaStreamContext.Provider>
  );
};
