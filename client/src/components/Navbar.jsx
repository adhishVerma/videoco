import React from "react";


const Navbar = () => {

  return (
    <div className="z-50 fixed top-0 left-0 right-0 flex items-center border-b border-skin-primary">
      <nav className="flex justify-between py-2 px-2 lg:px-0 container m-auto">
        <div className="flex items-center text-lg">
            <a href="/">
          <img src="/image.png" alt="logo" className="max-h-10"/></a>
        </div>
        <div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
