import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { connect } from 'react-redux';
import { setIsRoomHost, setRoomId } from "../store/actions";
import { useMedia } from "../context/MediaStreamContext";
import Button from "../components/ui/Button";
import { BsDisplay } from "react-icons/bs";
import { FaClosedCaptioning, FaPaperclip, FaLock, FaBolt } from "react-icons/fa";

const FEATURES = [
  {
    icon: BsDisplay,
    title: "Screen sharing",
    description: "Share your screen in one click to present, demo, or work through something together.",
  },
  {
    icon: FaClosedCaptioning,
    title: "Live captions",
    description: "Real-time captions powered by your browser - nothing to install, nothing to configure.",
  },
  {
    icon: FaPaperclip,
    title: "File sharing",
    description: "Drop images, videos, and documents right into the chat, no email attachments needed.",
  },
  {
    icon: FaLock,
    title: "Password-protected rooms",
    description: "Lock any room with a password so only the people you invite can join.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Create a room",
    description: "Start a room instantly - no account, no download, no setup.",
  },
  {
    step: "2",
    title: "Share the link",
    description: "Copy your room ID and send it to whoever you're calling.",
  },
  {
    step: "3",
    title: "Start talking",
    description: "Jump on video, share your screen, or drop a file - all in one place.",
  },
];

const Connect = ({ setIsRoomHostAction }) => {
  const navigate = useNavigate();
  const { setLocalStream, setRemoteStreams } = useMedia();


  useEffect(() => {
    setRemoteStreams([])
    setLocalStream(null);
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    setIsRoomHostAction(false);
    setRoomId(null);
  }, [setIsRoomHostAction])


  const pushToJoinRoomPage = () => {
    navigate(`/join-room`);
  }

  const pushToJoinRoomPageAsHost = () => {
    navigate(`/join-room?host=true`);
  }


  return (
    <div className="min-h-screen bg-white">
      <section className="pt-28 sm:pt-36 pb-16 px-4 text-center bg-gradient-to-b from-skin-secondary to-white">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F52B2] bg-skin-btn-primary/10 px-3 py-1 rounded-full mb-6">
            <FaBolt /> Free, no sign-up required
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4 leading-tight">
            Video calls that <span className="text-[#4F52B2]">just work</span>
          </h1>
          <p className="text-lg text-slate-500 mb-10 max-w-lg mx-auto">
            Start a secure video call in seconds - screen sharing, live captions, file sharing, and password-protected rooms, right in your browser.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" onClick={pushToJoinRoomPageAsHost} className="!text-base !py-3 !px-8 !min-w-0">
              Start a call
            </Button>
            <Button variant="secondary" onClick={pushToJoinRoomPage} className="!text-base !py-3 !px-8 !min-w-0 border border-skin-primary">
              Join a call
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-skin-secondary">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-slate-800 mb-10">
            Everything you need for a great call
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white rounded-xl p-6 shadow-sm border border-skin-primary/50">
                <div className="w-11 h-11 rounded-full bg-skin-btn-primary/10 text-[#4F52B2] flex items-center justify-center text-xl mb-4">
                  <Icon />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-slate-800 mb-10">
            Get started in three steps
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(({ step, title, description }) => (
              <div key={step} className="text-center">
                <div className="w-9 h-9 mx-auto rounded-full bg-skin-btn-primary text-skin-btn-primary flex items-center justify-center font-semibold mb-3">
                  {step}
                </div>
                <h3 className="font-semibold text-slate-800 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 text-center text-sm text-slate-400 border-t border-skin-primary">
        videoco
      </footer>
    </div>
  );
};

const mapActionsToProps = (dispatch) => {
  return {
    setIsRoomHostAction: (isRoomHost) => dispatch(setIsRoomHost(isRoomHost)),
    setRoomId: (roomId) => dispatch(setRoomId(roomId))
  }
}

export default connect(null, mapActionsToProps)(Connect);
