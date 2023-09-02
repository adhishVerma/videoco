import { useEffect } from "react";
import Stream from "../components/stream/Stream";
import { connect } from "react-redux";
import * as webRTCHandler from '../utils/webRTCHandler';
import Chat from "../components/Chat/Chat";

const Room = ({ roomId, identity, isRoomHost, connectOnlyAudio}) => {

  useEffect(() => {
    webRTCHandler.getLocalPreviewAndInitRoomConnection(isRoomHost, identity, roomId, connectOnlyAudio);
    // eslint-disable-next-line
  }, []);

  return (
    <div className="flex w-screen relative container m-auto h-screen py-20 justify-center gap-2 px-2">
      <div className="fixed top-0 text-center py-6 rounded-b px-4 z-50">Room Id: {roomId}</div>
      <div className="flex-1 shrink relative rounded-md overflow-hidden">
        <Stream /></div>
      <div className="hidden lg:block rounded-md px-2 overflow-hidden"><Chat /></div>
    </div>
  );
};


const mapStoreStatetoProps = (state) => {
  return {
    ...state
  }
}

export default connect(mapStoreStatetoProps)(Room);
