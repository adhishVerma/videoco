import React from "react";
import ReactPlayer from "react-player";
import { useMedia } from "../context/MediaStreamContext";
import { useSocket } from "../context/SocketContext";
import Footer from "./Footer";

const Stream = ({localStream, remoteStream}) => {
  
  const {mute} = useMedia()
  const {userEmail, guestEmail} = useSocket()
  return (
    <div className="flex w-full h-full relative max-w-[1440px]">
      <div className="absolute left-0 right-0 top-0 bottom-0 rounded-md  lg:border border-[rgba(255,255,255,0.39)] overflow-hidden shadow-md z-10">
        <ReactPlayer
          width="100%"
          height="100%"
          url={remoteStream}
          playing
          playsinline
          muted={mute}
        />
        <div className="text-white absolute bottom-3 left-3 bg-[rgba(0,0,0,0.29)] p-2 px-3 rounded-md text-base hidden md:block">{guestEmail}</div>
      </div>
      <div className="absolute right-8 bottom-8 w-1/3 xs:h-1/3 lg:h-1/4 lg:w-1/4 border border-[rgba(255,255,255,0.39)] rounded-md overflow-hidden max-w-sm lg:max-w-xl shadow-md z-10">
        <ReactPlayer
          height="100%"
          width="100%"
          url={localStream}
          muted
          playing
          playsinline
        />
        <div className="text-white absolute bottom-3 left-3 bg-[rgba(0,0,0,0.29)] p-1 px-2 rounded-md text-base lg:text-lg hidden md:block">{userEmail}</div>
      </div>
      <Footer />
    </div>
  );
};

export default Stream;
