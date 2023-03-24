import React from "react";
import { useMedia } from "../context/MediaStreamContext";

const Navbar = () => {

  const {remoteStream} = useMedia();

  return (
    <div className="z-10 fixed top-0 left-0 right-0 flex items-center py-3 bg-[#23272a]">
      <nav className="flex justify-between py-2 px-2 lg:px-0 container m-auto">
        <div className="flex items-center text-lg">
            <a href="/">
          <img src="/videoco.png" alt="logo" className="max-h-6"/></a>
        </div>
        <div>
          {remoteStream && <button className="bg-white hover:bg-red-500 active:bg-red-400 text-black hover:text-white rounded-2xl px-8 py-2">
            Leave
          </button>}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
