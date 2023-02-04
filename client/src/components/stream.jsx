import React from "react";
import ReactPlayer from "react-player";

const Stream = () => {
  return (
    <div className="container w-screen h-screen lg:py-16 relative m-auto">
      <div className="w-full h-full relative">
        <ReactPlayer
          className="absolute top-0 left-0 object-cover"
          width="100%"
          height="100%"
          url="https://www.youtube.com/watch?v=Nro6oFD3oHw"
          loop
          playing
          playsinline
        />
      </div>
      <div className="absolute z-10 bottom-24 right-6 border-2 rounded-xl h-[56vmin] w-[32vmin] lg:w-auto lg:max-h-44 overflow-hidden">
        <ReactPlayer
        className="object-cover min-h-full min-w-full"
          height="100%"
          width="100%"
          url="https://www.youtube.com/watch?v=Nro6oFD3oHw"
          muted
          loop
          playing
          playsinline
        />
      </div>
    </div>
  );
};

export default Stream;
