import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { connect } from 'react-redux';
import { setIsRoomHost, setRoomId } from "../store/actions";
import { useMedia } from "../context/MediaStreamContext";


const Connect = ({ setIsRoomHostAction }) => {
  const navigate = useNavigate();
  const {setLocalStream, setRemoteStreams} = useMedia();


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
    <div className="flex h-screen items-center justify-center">
      <div className="max-w-md w-full p-12 shadow-md border rounded-md">
        <div className="text-2xl mb-12 text-center">Create a room</div>
        <div className="flex flex-col gap-6">
          <button className="bg-green-500 hover:bg-green-600 active:bg-green-400 text-white rounded-md px-8 py-2 w-1/2 self-center" onClick={pushToJoinRoomPage}>Join</button>
          <button className="bg-blue-500 hover:bg-blue-600 active:bg-blue-400 text-white rounded-md px-8 py-2 w-1/2 self-center" onClick={pushToJoinRoomPageAsHost}>Create</button>
        </div>
      </div>
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
