import React from "react";
import { FaMicrophone, FaMicrophoneSlash, FaClosedCaptioning, FaVideo, FaVideoSlash, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { IoChatboxEllipses } from "react-icons/io5";
import { MdCallEnd } from "react-icons/md";
import { useMedia } from "../../context/MediaStreamContext";
import { CALL_STATUS } from "../../utils/callStatus";
import { ScreenSharingButton } from "./ScreenSharingButton";
import Button from "../ui/Button";

// The bar always renders (Leave included) - it used to appear only once the
// camera stream existed, so a call stuck connecting had no way out at all.
// The controls that need a live connection are simply disabled until then.
const Footer = ({ chatToggle, unreadCount = 0, onLeave }) => {
  const {
    mute,
    setMute,
    micMuted,
    videoOpen,
    toggleAudio,
    toggleVideo,
    captionsEnabled,
    toggleCaptions,
    captionsSupported,
    callStatus,
  } = useMedia();

  const live = callStatus.status === CALL_STATUS.CONNECTED || callStatus.status === CALL_STATUS.RECONNECTING;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center px-3 pointer-events-none">
      <div role="toolbar" aria-label="Call controls" className="pointer-events-auto flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 bg-room-bg/85 backdrop-blur-xl border border-room-border rounded-2xl px-2 sm:px-3 py-2 sm:py-2.5 shadow-tile animate-slide-up">
        <Button
          variant="icon"
          active={micMuted}
          disabled={!live}
          aria-pressed={micMuted}
          onClick={() => toggleAudio(!micMuted)}
          title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {micMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </Button>
        <Button
          variant="icon"
          active={!videoOpen}
          disabled={!live}
          aria-pressed={!videoOpen}
          onClick={() => toggleVideo(!videoOpen)}
          title={videoOpen ? 'Turn off camera' : 'Turn on camera'}
        >
          {videoOpen ? <FaVideo /> : <FaVideoSlash />}
        </Button>
        <ScreenSharingButton disabled={!live} />
        {captionsSupported && (
          <Button
            variant="icon"
            onClick={toggleCaptions}
            aria-pressed={captionsEnabled}
            className={captionsEnabled ? '!bg-brand-600 hover:!bg-brand-700' : ''}
            title={captionsEnabled ? 'Turn off captions' : 'Turn on captions'}
          >
            <FaClosedCaptioning />
          </Button>
        )}
        <Button
          variant="icon"
          active={mute}
          aria-pressed={mute}
          onClick={() => setMute(!mute)}
          title={mute ? 'Unmute speaker' : 'Mute speaker'}
        >
          {mute ? <FaVolumeMute /> : <FaVolumeUp />}
        </Button>
        <div className="relative">
          <Button variant="icon" onClick={chatToggle} title="Chat">
            <IoChatboxEllipses />
          </Button>
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread messages`}
              className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-brand-500 text-white text-xs font-semibold flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <Button variant="danger" onClick={onLeave} title="Leave call" className="!rounded-full h-10 sm:h-11 px-4 sm:px-5">
          <MdCallEnd className="text-xl" />
          <span className="hidden sm:inline">Leave</span>
        </Button>
      </div>
    </div>
  );
};

export default Footer;
