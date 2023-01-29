import React from "react";
import { FaMicrophone } from "react-icons/fa";
import { IoVideocam } from "react-icons/io5";
import { AiFillSound } from "react-icons/ai";

const Footer = () => {
  return (
    <div className="fixed bg-transparent bottom-0 left-0 right-0 flex justify-center gap-3 py-5 text-2xl z-10">
      <div className="bg-[#00000046] p-3 rounded-full opacity-50 hover:opacity-100 hover:scale-110">
        <IoVideocam />
      </div>
      <div className="bg-[#00000046] p-3  rounded-full opacity-50 hover:opacity-100 hover:scale-110">
        <FaMicrophone />
      </div>
      <div className="bg-[#00000046] p-3  rounded-full opacity-50 hover:opacity-100 hover:scale-110">
        <AiFillSound />
      </div>
    </div>
  );
};

export default Footer;
