import { useCallback, useEffect, useRef, useState } from "react";
import Stream from "../components/stream/Stream";
import Footer from "../components/stream/Footer";
import ConnectionStatus from "../components/stream/ConnectionStatus";
import IdleBanner from "../components/stream/IdleBanner";
import { connect } from "react-redux";
import * as webRTCHandler from '../utils/webRTCHandler';
import { extendRoom } from '../utils/wss';
import Chat from "../components/Chat/Chat";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useMedia } from "../context/MediaStreamContext";

const JOIN_ERROR_MESSAGES = {
  'invalid-password': 'Wrong room password',
  'not-found': 'Room not found',
  'full': 'This room is full',
  'invalid-name': 'Please enter a name to join',
};

const END_REASON_MESSAGES = {
  'connection-lost': 'Lost connection to the server - the call ended',
  'media-disconnected': 'Lost connection to the call - it ended',
};

const Room = ({ roomId, identity, isRoomHost, connectOnlyAudio, roomPassword, participantCount }) => {
  const navigate = useNavigate();
  const { closeStream, resetCallUi, setVideoOpen, callStatus } = useMedia();
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [idleWarning, setIdleWarning] = useState(null);

  // The call is started once, from what the join page set. Kept in a ref so a
  // retry re-uses exactly the same details even after the store has moved on.
  const session = useRef({ isRoomHost, identity, roomId, connectOnlyAudio, roomPassword });

  // Redux state lives in memory only. Reloading /room, or opening it
  // directly, arrives here with no name and no room - and the call flow
  // would then wait forever for a join that can never succeed (a guest has no
  // room id to join; there's no name to join under). Send them back instead.
  const { identity: sessionIdentity, isRoomHost: sessionIsHost, roomId: sessionRoomId } = session.current;
  const canStart = !!sessionIdentity && (sessionIsHost || !!sessionRoomId);

  // latest closeStream for handlers registered once
  const closeRef = useRef(closeStream);
  closeRef.current = closeStream;

  const leaveRoomPage = useCallback(() => {
    closeRef.current();
    navigate('/');
  }, [navigate]);

  const startCall = useCallback(() => {
    const s = session.current;
    return webRTCHandler.getLocalPreviewAndInitRoomConnection(s.isRoomHost, s.identity, s.roomId, s.connectOnlyAudio, s.roomPassword);
  }, []);

  const retry = () => {
    // drop whatever the failed attempt left behind, but keep the room details
    webRTCHandler.leaveCall({ keepRoomState: true });
    startCall();
  };

  useEffect(() => {
    if (!canStart) {
      toast.info('Your session expired - please join again.', { position: 'bottom-right' });
      navigate('/', { replace: true });
      return undefined;
    }

    resetCallUi();
    setVideoOpen(!session.current.connectOnlyAudio);
    startCall();

    // leaving by ANY route (button, browser back, a link, a kick) must release
    // the camera, the media-server connection and the server-side seat
    return () => {
      webRTCHandler.leaveCall();
      resetCallUi();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const handleJoinError = (event) => {
      const { reason } = event.detail;
      toast.error(JOIN_ERROR_MESSAGES[reason] || 'Could not join the room', { position: "bottom-right" });
      navigate('/join-room');
    }

    const handleMediaAccessError = (event) => {
      const err = event.detail?.error;
      console.error('media access error', err?.name, err?.message, err);
      const reason = err?.name ? ` (${err.name})` : '';
      toast.error(`Could not access your camera/microphone${reason}. Check browser permissions and try again.`, { position: "bottom-right" });
    }

    const handleCallConnectionError = (event) => {
      console.error('call connection error', event.detail.error, event.detail.error.cause || '');
      toast.error('Could not connect to the call server. Check your connection and try again.', { position: "bottom-right" });
    }

    const handleRemovedFromRoom = () => {
      toast.error('The host removed you from the room', { position: "bottom-right" });
      leaveRoomPage();
    }

    const handleCallEnded = (event) => {
      toast.error(END_REASON_MESSAGES[event.detail?.reason] || 'The call ended', { position: "bottom-right" });
      leaveRoomPage();
    }

    const handleIdleWarning = (event) => setIdleWarning({ secondsLeft: event.detail?.secondsLeft ?? 60 });

    const handleIdleTimeout = () => {
      toast.info('The room was closed because nobody else joined', { position: "bottom-right", autoClose: 8000 });
      leaveRoomPage();
    }

    window.addEventListener('join-error', handleJoinError);
    window.addEventListener('media-access-error', handleMediaAccessError);
    window.addEventListener('call-connection-error', handleCallConnectionError);
    window.addEventListener('removed-from-room', handleRemovedFromRoom);
    window.addEventListener('call-ended', handleCallEnded);
    window.addEventListener('room-idle-warning', handleIdleWarning);
    window.addEventListener('room-idle-timeout', handleIdleTimeout);

    return () => {
      window.removeEventListener('join-error', handleJoinError);
      window.removeEventListener('media-access-error', handleMediaAccessError);
      window.removeEventListener('call-connection-error', handleCallConnectionError);
      window.removeEventListener('removed-from-room', handleRemovedFromRoom);
      window.removeEventListener('call-ended', handleCallEnded);
      window.removeEventListener('room-idle-warning', handleIdleWarning);
      window.removeEventListener('room-idle-timeout', handleIdleTimeout);
    }
  }, [navigate, leaveRoomPage]);

  const keepRoomOpen = () => {
    extendRoom();
    setIdleWarning(null);
  };

  // someone arriving ends the countdown on the server; hide the banner too
  useEffect(() => {
    if (participantCount > 1) setIdleWarning(null);
  }, [participantCount]);

  const toggleChat = () => {
    setChatOpen((open) => !open);
    setUnreadCount(0);
  };

  if (!canStart) return null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-room-bg">
      <div className="relative h-full pt-14 pb-24">
        <Stream />
        <ConnectionStatus status={callStatus.status} kind={callStatus.kind} onRetry={retry} onLeave={leaveRoomPage} />
        {idleWarning && <IdleBanner secondsLeft={idleWarning.secondsLeft} onKeepOpen={keepRoomOpen} />}
      </div>

      <Footer chatToggle={toggleChat} unreadCount={unreadCount} onLeave={leaveRoomPage} />

      {chatOpen && (
        <div className="fixed inset-0 bg-black/50 z-30" onClick={toggleChat} />
      )}
      <aside
        aria-label="Chat"
        aria-hidden={!chatOpen}
        className={`fixed top-0 right-0 z-40 h-full w-full sm:w-96 max-w-full bg-room-raised border-l border-room-border shadow-2xl pt-14 transition-transform duration-300 ease-in-out ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <Chat
          onClose={toggleChat}
          isOpen={chatOpen}
          onUnread={() => setUnreadCount((n) => n + 1)}
        />
      </aside>
    </div>
  );
};


const mapStoreStatetoProps = (state) => {
  return {
    roomId: state.roomId,
    identity: state.identity,
    isRoomHost: state.isRoomHost,
    connectOnlyAudio: state.connectOnlyAudio,
    roomPassword: state.roomPassword,
    participantCount: state.participants.length,
  }
}

export default connect(mapStoreStatetoProps)(Room);
