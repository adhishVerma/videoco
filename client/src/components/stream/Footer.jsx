import React, { useEffect } from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { IoVideocam, IoVideocamOff } from "react-icons/io5";
import { BsFillVolumeUpFill, BsFillVolumeMuteFill } from "react-icons/bs";
import { useMedia } from "../../context/MediaStreamContext";
import { useNavigate } from "react-router-dom";
import { ScreenSharingButton } from "./ScreenSharingButton";
import {connect} from "react-redux";

const Footer = ({onlyWithAudio}) => {
  let navigate = useNavigate();
  const {
    mute,
    setMute,
    micMuted,
    setMicMuted,
    videoOpen,
    setVideoOpen,
    localStream,
    closeStream,
    toggleAudio,
    toggleVideo
  } = useMedia();


  // Leave the call
  const handleLeave = () => {
    closeStream();
    navigate("/");
  }

  //   toggle video track
  const toggleCamera = () => {
    toggleVideo()
    setVideoOpen(!videoOpen);
  };
  
  // toggle audio track
  const toggleMic = () => {
    toggleAudio();
    setMicMuted(!micMuted);
  };

  useEffect(() => {
    if(onlyWithAudio){
      toggleCamera();
    }
  })

  return (
    <>
      {localStream && (
        <div className="controls">
          <div className="fixed bottom-0 left-0 right-0 flex justify-center gap-3 pb-3 text-xl z-10 items-center">
            <button
              className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110"
              onClick={toggleCamera}
            >
              {videoOpen ? <IoVideocamOff /> : <IoVideocam />}
            </button>
            <button
              className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110"
              onClick={toggleMic}
            >
              {!micMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </button>
            <button
              className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110"
              onClick={() => {
                setMute(!mute);
              }}
            >
              {mute ? <BsFillVolumeMuteFill /> : <BsFillVolumeUpFill />}
            </button>
            <button onClick={handleLeave} className="bg-red-500 hover:bg-red-600 active:bg-red-600 text-base text-gray-100 hover:text-white px-3 rounded-lg scale-90 py-1">
              Leave
            </button>
            <ScreenSharingButton />
          </div>
        </div>
      )}
    </>
  );
};

const mapStoreStatetoProps = (state) => {
  return {
    ...state
  }
}

export default connect(mapStoreStatetoProps)(Footer);
