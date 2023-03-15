import React from "react";
import { FaMicrophone } from "react-icons/fa";
import { IoVideocam } from "react-icons/io5";
import { BsFillVolumeUpFill, BsFillVolumeMuteFill } from "react-icons/bs";
import { useMedia } from "../context/MediaStreamContext";


const Footer = () => {
  const {remoteStream, mute,setMute} = useMedia();
  return (
    <div>
      {<div className="controls">
        <div className="fixed bg-gray-800 bottom-0 left-0 right-0 flex justify-center gap-3 py-4 text-2xl z-10">
          <button className="bg-[#00000071] p-3 rounded-full opacity-50 hover:opacity-100 hover:scale-110">
            <IoVideocam />
          </button>
          <button className="bg-[#00000071] p-3  rounded-full opacity-50 hover:opacity-100 hover:scale-110">
            <FaMicrophone />
          </button>
          <button className="bg-[#00000071] p-3  rounded-full opacity-50 hover:opacity-100 hover:scale-110" onClick={()=>{setMute(!mute)}}>
            {mute ? <BsFillVolumeMuteFill /> : <BsFillVolumeUpFill/>}
          </button>
        </div>
      </div>}
    </div>
  );
};

export default Footer;
