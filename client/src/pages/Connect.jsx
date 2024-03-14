import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { connect } from 'react-redux';
import { setIsRoomHost, setRoomId } from "../store/actions";
import { useMedia } from "../context/MediaStreamContext";
import Button from "../components/ui/Button";


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
    <div className="flex px-2 h-screen justify-center">
      <div className="max-w-md w-full  mt-56 p-6 bg-white">
        <div className="text-2xl font-semibold text-slate-700 mb-12 text-center">Create a room</div>
        <div className="flex flex-col gap-6">
          <Button variant='primary' onClick={pushToJoinRoomPage}>Join</Button>
          <Button variant='secondary' onClick={pushToJoinRoomPageAsHost}>Create</Button>
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
