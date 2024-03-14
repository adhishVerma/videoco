import React, { useState } from 'react'
import { JoinRoomInputs } from './JoinRoomInputs';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { OnlyWithAudioCheck } from './OnlyWithAudioCheck';
import { setConnectOnlyAudio, setIdentity, setRoomId } from '../../store/actions';
import { toast } from 'react-toastify';
import { getRoomExists } from '../../utils/api';
import Button from '../ui/Button';


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
    if (isRoomHost) {
      createRoom();
    } else {
      await joinRoom();
    }
  }

  const joinRoom = async () => {
    try {
      const res = await getRoomExists(roomIdValue);
      const { roomExists, full } = res;
      if (roomExists) {
        if (full) {
          toast.info('Room is Full', {
            position: "bottom-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
          });
        } else {
          // join the room logic
          setRoomAction(roomIdValue);
          navigate(`/room`);
        }
      } else {
        toast.error("Room not found", {
          position: "bottom-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
      }
    } catch (err) {
      toast.error("Check roomId", {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
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
      <Button variant='primary' onClick={handleJoinRoom}>Join</Button>
      <Button variant='danger' onClick={pushToHome}>Cancel</Button>
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
    setIdentityAction: (identity) => dispatch(setIdentity(identity)),
    setRoomAction: (roomId) => dispatch(setRoomId(roomId)),
  }
}

export default connect(mapStoreStateToProps, mapActionsToProps)(JoinRoomContent);