import React from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { IoVideocam, IoVideocamOff } from "react-icons/io5";
import { BsFillVolumeUpFill, BsFillVolumeMuteFill } from "react-icons/bs";
import { useMedia } from "../context/MediaStreamContext";
import { usePeer } from "../context/PeerContext";
import { useNavigate } from "react-router-dom";

const Footer = () => {
  let navigate = useNavigate();
  const {
    remoteStream,
    mute,
    setMute,
    micOpen,
    setMicOpen,
    videoOpen,
    setVideoOpen,
    localStream,
    closeStream
  } = useMedia();
  const { toggleAudioTrack, toggleVideoTrack } = usePeer();

  // Leave the call
  const handleLeave = () => {
    closeStream();
    navigate("/");
  }

  //   toggle video track
  const toggleVideo = () => {
    setVideoOpen(!videoOpen);
    toggleVideoTrack(localStream, videoOpen);
  };
  // toggle audio track
  const toggleAudio = () => {
    setMicOpen(!micOpen);
    toggleAudioTrack(localStream, micOpen);
  };

  return (
    <>
      {remoteStream && (
        <div className="controls">
          <div className="fixed bottom-0 left-0 right-0 flex justify-center gap-3 pb-3 text-xl z-10 items-center">
            <button
              className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110 hover:text-white"
              onClick={toggleVideo}
            >
              {videoOpen ? <IoVideocamOff/>: <IoVideocam /> }
            </button>
            <button 
              className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110 hover:text-white"
              onClick={toggleAudio}
            >
              {micOpen ? <FaMicrophoneSlash/>:<FaMicrophone />}
            </button>
            <button
              className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110 hover:text-white"
              onClick={() => {
                setMute(!mute);
              }}
            >
              {mute ? <BsFillVolumeMuteFill /> : <BsFillVolumeUpFill />}
            </button>
            {remoteStream && <button onClick={handleLeave} className="bg-red-500 hover:bg-red-600 active:bg-red-600 text-lg hover:text-white px-3 rounded-lg scale-90 py-1">
            Leave
          </button>}
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
