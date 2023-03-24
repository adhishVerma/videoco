import React from "react";
import ReactPlayer from "react-player";
import { useMedia } from "../context/MediaStreamContext";
import { useSocket } from "../context/SocketContext";

const Stream = ({localStream, remoteStream}) => {
  
  const {mute} = useMedia()
  const {userEmail, guestEmail} = useSocket()
  return (
    <div className="flex w-screen h-screen relative m-auto max-w-[1440px]">
      <div className="absolute lg:bottom-20 left-0 right-0 lg:top-24 top-0 bottom-0 rounded-md  lg:border-2 overflow-hidden shadow-md">
        <ReactPlayer
          width="100%"
          height="100%"
          url={remoteStream}
          playing
          playsinline
          muted={mute}
        />
        <div className="text-white absolute bottom-0 left-0 bg-slate-800 p-4 rounded-sm text-2xl hidden md:block">{guestEmail}</div>
      </div>
      <div className="absolute right-8 lg:bottom-28 bottom-8 w-1/2 xs:h-1/3 lg:h-1/4 lg:w-1/4 border-2 rounded-md overflow-hidden max-w-sm lg:max-w-xl shadow-md">
        <ReactPlayer
          height="100%"
          width="100%"
          url={localStream}
          muted
          playing
          playsinline
        />
        <div className="text-white absolute bottom-0 left-0 bg-slate-800 p-2 rounded-sm text-2xl lg:text-lg hidden md:block">{userEmail}</div>
      </div>
    </div>
  );
};

export default Stream;
