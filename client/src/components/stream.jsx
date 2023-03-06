import React from "react";
import ReactPlayer from "react-player";

const Stream = ({localStream, remoteStream}) => {
  
  return (
    <div className="container flex w-screen h-screen lg:py-16 relative m-auto">
      <div className="absolute bottom-0 left-0 right-0 top-0">
        <ReactPlayer
          width="100%"
          height="100%"
          url={localStream}
          playing
          playsinline
        />
        <div className="text-white absolute bottom-0 left-0 bg-slate-800 p-5 rounded-sm text-2xl">Name</div>
      </div>
      <div className="absolute right-[-75px] bottom-[-20px] scale-50 border-2 rounded-2xl overflow-hidden max-w-sm lg:max-w-xl">
        <ReactPlayer
          height="100%"
          width="100%"
          url={localStream}
          muted
          playing
          playsinline
        />
        <div className="text-white absolute bottom-0 left-0 bg-slate-800 p-5 rounded-sm text-2xl">Name</div>
      </div>
    </div>
  );
};

export default Stream;
