import React from "react";
import { FaMicrophone } from "react-icons/fa";
import { IoVideocam } from "react-icons/io5";
import { BsFillVolumeUpFill, BsFillVolumeMuteFill } from "react-icons/bs";
import { useMedia } from "../context/MediaStreamContext";
import { usePeer } from "../context/PeerContext";

const Footer = () => {
  const {
    remoteStream,
    mute,
    setMute,
    micOpen,
    setMicOpen,
    videoOpen,
    setVideoOpen,
    localStream,
  } = useMedia();
  const { toggleAudioTrack, toggleVideoTrack } = usePeer();

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
          <div className="fixed  bottom-0 left-0 right-0 flex justify-center gap-3 py-4 text-2xl z-10">
            <button
              className="bg-[#00000071] p-3 rounded-full opacity-50 hover:opacity-100 hover:scale-110 hover:text-white"
              onClick={toggleVideo}
            >
              <IoVideocam />
            </button>
            <button
              className="bg-[#00000071] p-3  rounded-full opacity-50 hover:opacity-100 hover:scale-110 hover:text-white"
              onClick={toggleAudio}
            >
              <FaMicrophone />
            </button>
            <button
              className="bg-[#00000071] p-3  rounded-full opacity-50 hover:opacity-100 hover:scale-110 hover:text-white"
              onClick={() => {
                setMute(!mute);
              }}
            >
              {mute ? <BsFillVolumeMuteFill /> : <BsFillVolumeUpFill />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
