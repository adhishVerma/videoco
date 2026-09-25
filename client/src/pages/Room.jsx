import { useEffect, useState } from "react";
import Stream from "../components/stream/Stream";
import { connect } from "react-redux";
import * as webRTCHandler from '../utils/webRTCHandler';
import Chat from "../components/Chat/Chat";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";


const Room = ({ roomId, identity, isRoomHost, connectOnlyAudio, roomPassword }) => {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const toggleChat = () => setChatOpen((open) => !open);

  useEffect(() => {
    webRTCHandler.getLocalPreviewAndInitRoomConnection(isRoomHost, identity, roomId, connectOnlyAudio, roomPassword);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const handleJoinError = (event) => {
      const { reason } = event.detail;
      const message = reason === 'invalid-password' ? 'Wrong room password' : 'Room not found';
      toast.error(message, { position: "bottom-right" });
      navigate('/join-room');
    }

    const handleMediaAccessError = () => {
      toast.error('Could not access your camera/microphone. Check browser permissions and try again.', { position: "bottom-right" });
    }

    window.addEventListener('join-error', handleJoinError);
    window.addEventListener('media-access-error', handleMediaAccessError);

    return () => {
      window.removeEventListener('join-error', handleJoinError);
      window.removeEventListener('media-access-error', handleMediaAccessError);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-skin-secondary">
      <div className="h-full pt-16 pb-2 px-2">
        <Stream chatToggle={toggleChat} />
      </div>

      {chatOpen && (
        <div className="fixed inset-0 bg-black/30 z-30" onClick={toggleChat} />
      )}
      <div
        className={`fixed top-0 right-0 z-40 h-full w-full sm:w-96 max-w-full bg-white shadow-2xl pt-16 transition-transform duration-300 ease-in-out ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <Chat onClose={toggleChat} />
      </div>
    </div>
  );
};


const mapStoreStatetoProps = (state) => {
  return {
    ...state
  }
}

export default connect(mapStoreStatetoProps)(Room);
