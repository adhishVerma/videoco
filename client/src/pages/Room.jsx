import { useEffect } from "react";
import Stream from "../components/stream/Stream";
import { connect } from "react-redux";
import * as webRTCHandler from '../utils/webRTCHandler';
import Chat from "../components/Chat/Chat";
import { useSpring, animated } from '@react-spring/web'


const Room = ({ roomId, identity, isRoomHost, connectOnlyAudio }) => {
  const [springs, api] = useSpring(() => ({
    from: { width: '24rem'},
  }));


  const showChat = () => {
    api.start({
      to: {
        width: springs.width.get() === '24rem' ? '0rem' : '24rem',
      },
    })
  }

  useEffect(() => {
    webRTCHandler.getLocalPreviewAndInitRoomConnection(isRoomHost, identity, roomId, connectOnlyAudio);
    // eslint-disable-next-line
  }, []);

  return (
    <div className="flex w-screen relative container m-auto h-screen py-20 justify-center gap-2 px-2">
      <div className="fixed top-0 text-center py-6 rounded-b px-4 z-50">Room Id: {roomId}</div>
      <div className="flex-1 relative rounded overflow-hidden">
        <Stream chatToggle={showChat}/>
      </div>
      <animated.div style={{ ...springs }} className="border-skin-primary hidden lg:block rounded overflow-hidden shadow"><Chat /></animated.div>
    </div>
  );
};


const mapStoreStatetoProps = (state) => {
  return {
    ...state
  }
}

export default connect(mapStoreStatetoProps)(Room);
