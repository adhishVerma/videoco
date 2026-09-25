import React, { useEffect } from "react";
import { FaMicrophone, FaMicrophoneSlash, FaClosedCaptioning } from "react-icons/fa";
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
    toggleVideo,
    captionsEnabled,
    toggleCaptions,
    captionsSupported
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
        <div className="fixed bottom-0 left-0 right-0 z-10 flex justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap justify-center items-center gap-2 bg-white/95 backdrop-blur shadow-lg rounded-2xl px-2 py-2">
            <Button
              variant="icon"
              onClick={toggleCamera}
              title={videoOpen ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoOpen ? <IoVideocamOff /> : <IoVideocam />}
            </Button>
            <Button
              variant="icon"
              onClick={toggleMic}
              title={!micMuted ? 'Mute mic' : 'Unmute mic'}
            >
              {!micMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </Button>
            <Button variant="icon"
              onClick={() => {
                setMute(!mute);
              }}
              title={mute ? 'Unmute speaker' : 'Mute speaker'}
            >
              {mute ? <BsFillVolumeMuteFill /> : <BsFillVolumeUpFill />}
            </Button>
            <ScreenSharingButton />
            {captionsSupported && (
              <Button
                variant="icon"
                onClick={toggleCaptions}
                className={captionsEnabled ? '!text-blue-500' : ''}
                title={captionsEnabled ? 'Turn off captions' : 'Turn on captions'}
              >
                <FaClosedCaptioning />
              </Button>
            )}
            <Button variant="icon" onClick={chatToggle} title="Chat"><IoChatboxEllipses /></Button>
            <Button variant='danger' onClick={handleLeave} className="!min-w-[44px] !min-h-[44px] text-gray-100 hover:text-white">
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
