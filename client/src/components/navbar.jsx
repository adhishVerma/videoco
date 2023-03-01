import React from "react";

const Navbar = () => {
  return (
    <div className="z-10 fixed top-0 left-0 right-0 h-14">
      <nav className="flex justify-between py-2 px-2 lg:px-0 container m-auto">
        <div className="flex items-center text-lg">
          <img src="/videoco.png" alt="logo" className="max-h-6"/>
        </div>
        <div></div>
        <div></div>
        <div>
          <button className="bg-white hover:bg-gray-300 active:bg-gray-400 text-black rounded-2xl px-8 py-2">
            Leave
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
