import React, { createContext } from "react";
import { useContext } from "react";

export const MediaStreamContext = createContext();

export const useMedia = () => {
  return useContext(MediaStreamContext);
};

export const MediaStreamProvider = (props) => {
  const [remoteStream, setRemoteStream] = React.useState();
  const [localStream, setLocalStream] = React.useState(null);
  const [mute, setMute] = React.useState(false);
  const [micOpen, setMicOpen] = React.useState(true);
  const [videoOpen, setVideoOpen] = React.useState(true);

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
        micOpen, setMicOpen
      }}
    >
      {props.children}
    </MediaStreamContext.Provider>
  );
};
