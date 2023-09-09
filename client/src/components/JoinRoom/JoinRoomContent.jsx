import React, { useState } from 'react'
import { JoinRoomInputs } from './JoinRoomInputs';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { OnlyWithAudioCheck } from './OnlyWithAudioCheck';
import { setConnectOnlyAudio, setIdentity, setRoomId } from '../../store/actions';
import { toast } from 'react-toastify';
import { getRoomExists } from '../../utils/api';


const JoinRoomContent = (props) => {
  const { isRoomHost, setConnectOnlyAudio, connectOnlyAudio, setRoomAction, setIdentityAction } = props;
  const [roomIdValue, setRoomIdValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const navigate = useNavigate();


  const pushToHome = () => {
    navigate('/');
  }

  const handleJoinRoom = async () => {

    // request the server if room exists.
    setIdentityAction(nameValue);
    if(isRoomHost){
      createRoom();
    }else{
      await joinRoom();
    }
  }
  
  const joinRoom = async () => {
    
    const res = await getRoomExists(roomIdValue);
    const { roomExists, full } = res;
    if (roomExists) {
      if (full) {
        toast.info('Room is Full', {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        });
      } else {
        // join the room logic
        setRoomAction(roomIdValue);
        navigate(`/room`);
      }
    } else {
      toast.error('Room Not Found', {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
    }
  }

  const createRoom = () => {
    navigate(`/room`);
  }

  return (
    <>
      <JoinRoomInputs
        roomIdValue={roomIdValue}
        setRoomIdValue={setRoomIdValue}
        nameValue={nameValue}
        setNameValue={setNameValue}
        isRoomHost={isRoomHost}
      />
      <OnlyWithAudioCheck
        setConnectOnlyAudio={setConnectOnlyAudio}
        connectOnlyAudio={connectOnlyAudio}
      />
      <button className="bg-green-500 hover:bg-green-600 active:bg-green-400 text-white rounded-md px-8 py-2 w-1/2 self-center" onClick={handleJoinRoom}>Join</button>
      <button className="bg-red-500 hover:bg-red-600 active:bg-red-400 text-white rounded-md px-8 py-2 w-1/2 self-center" onClick={pushToHome}>Cancel</button>
    </>
  )
};

const mapStoreStateToProps = (state) => {
  return {
    ...state
  }
}

const mapActionsToProps = (dispatch) => {
  return {
    setConnectOnlyAudio: (onlyWithAudio) => dispatch(setConnectOnlyAudio(onlyWithAudio)),
    setIdentityAction : (identity) => dispatch(setIdentity(identity)),
    setRoomAction : (roomId) => dispatch(setRoomId(roomId)),
  }
}

export default connect(mapStoreStateToProps, mapActionsToProps)(JoinRoomContent);