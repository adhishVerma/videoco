import React, { useEffect } from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { IoVideocam, IoVideocamOff, IoChatboxEllipses } from "react-icons/io5";
import { BsFillVolumeUpFill, BsFillVolumeMuteFill } from "react-icons/bs";
import { useMedia } from "../../context/MediaStreamContext";
import { useNavigate } from "react-router-dom";
import { ScreenSharingButton } from "./ScreenSharingButton";
import { connect } from "react-redux";
import Button from "../ui/Button";

const Footer = ({ onlyWithAudio, chatToggle }) => {
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
    if (onlyWithAudio) {
      toggleCamera();
    }
  })

  return (
    <>
      {localStream && (
        <div className="controls">
          <div className="fixed hover:bg-neutral-200 transition-colors duration-700 py-2 bottom-0 left-0 right-0 flex justify-center gap-3 text-xl z-10 items-center">
            <Button
              variant="icon"
              onClick={toggleCamera}
            >
              {videoOpen ? <IoVideocamOff /> : <IoVideocam />}
            </Button>
            <Button
              variant="icon"
              onClick={toggleMic}
            >
              {!micMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </Button>
            <Button variant="icon"
              onClick={() => {
                setMute(!mute);
              }}
            >
              {mute ? <BsFillVolumeMuteFill /> : <BsFillVolumeUpFill />}
            </Button>
            <ScreenSharingButton />
            <Button variant="icon" onClick={chatToggle}><IoChatboxEllipses /></Button>
            <Button variant='danger' onClick={handleLeave} className="bg-red-500 hover:bg-red-600 active:bg-red-600 text-base text-gray-100 hover:text-white px-3 rounded-lg scale-90 py-1">
              Leave
            </Button>
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
