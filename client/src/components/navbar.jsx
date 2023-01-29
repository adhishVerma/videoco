import React from "react";
import { IoVideocam } from "react-icons/io5";

const Navbar = () => {
  return (
    <div className="z-10 fixed top-0 left-0 right-0 py-3">
      <nav className="flex justify-between py-2 px-2 lg:px-0 container m-auto">
        <div className="flex items-center text-lg">
          {/* <IoVideocam className="text-green-400 hover:animate-pulse" />
          <span className="ml-2 font-medium tracking-wide uppercase cursor-pointer">
            straem
          </span> */}
          <img src="/videoco.png" alt="logo" className="max-h-6"/>
        </div>
        <div></div>
        <div></div>
        <div>
          <button className="bg-white hover:bg-gray-300 active:bg-gray-400 text-black rounded-2xl px-4">
            leave
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
