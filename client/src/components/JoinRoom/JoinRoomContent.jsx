import React, { useState } from 'react'
import { JoinRoomInputs } from './JoinRoomInputs';
import { connect } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { OnlyWithAudioCheck } from './OnlyWithAudioCheck';
import { setConnectOnlyAudio, setIdentity, setRoomId, setRoomPassword } from '../../store/actions';
import { getRoomExists } from '../../utils/api';
import Button from '../ui/Button';


export const JoinRoomContent = ({ isRoomHost, setConnectOnlyAudio, connectOnlyAudio, setRoomAction, setIdentityAction, setRoomPasswordAction }) => {
  const [searchParams] = useSearchParams();
  // an invite link carries the room id, so a guest only has to type a name
  const [roomIdValue, setRoomIdValue] = useState(searchParams.get('room') || "");
  const [nameValue, setNameValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const pushToHome = () => {
    navigate('/');
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (checking) return;

    const name = nameValue.trim();
    const roomId = roomIdValue.trim();

    // an empty name used to go straight through and show up as "guest"
    const nextErrors = {};
    if (!name) nextErrors.name = 'Enter a name so others know who you are.';
    if (!isRoomHost && !roomId) nextErrors.roomId = 'A room ID is required to join.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setIdentityAction(name);
    setRoomPasswordAction(passwordValue);

    if (isRoomHost) {
      setRoomAction(null);
      navigate('/room');
      return;
    }

    setChecking(true);
    try {
      const { roomExists, full, passwordProtected } = await getRoomExists(roomId);
      if (!roomExists) {
        setErrors({ roomId: 'No room found with that ID. Check it and try again.' });
      } else if (full) {
        setErrors({ roomId: 'This room is full right now.' });
      } else if (passwordProtected && !passwordValue) {
        // only ask for a password once we know the room needs one
        setShowPassword(true);
        setErrors({ password: 'This room is password protected - enter the password.' });
      } else {
        setRoomAction(roomId);
        navigate('/room');
      }
    } catch (err) {
      setErrors({ roomId: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className='flex flex-col gap-5 w-full'>
      <JoinRoomInputs
        roomIdValue={roomIdValue}
        setRoomIdValue={setRoomIdValue}
        nameValue={nameValue}
        setNameValue={setNameValue}
        passwordValue={passwordValue}
        setPasswordValue={setPasswordValue}
        isRoomHost={isRoomHost}
        showPassword={showPassword}
        errors={errors}
      />
      <OnlyWithAudioCheck
        setConnectOnlyAudio={setConnectOnlyAudio}
        connectOnlyAudio={connectOnlyAudio}
      />
      <div className='flex flex-col-reverse sm:flex-row gap-3'>
        <Button variant='secondary' onClick={pushToHome} className='sm:flex-1'>Cancel</Button>
        <Button type='submit' variant='primary' disabled={checking} className='sm:flex-1'>
          {checking ? 'Checking...' : (isRoomHost ? 'Start call' : 'Join call')}
        </Button>
      </div>
    </form>
  )
};

const mapStoreStateToProps = (state) => {
  return {
    isRoomHost: state.isRoomHost,
    connectOnlyAudio: state.connectOnlyAudio,
  }
}

const mapActionsToProps = (dispatch) => {
  return {
    setConnectOnlyAudio: (onlyWithAudio) => dispatch(setConnectOnlyAudio(onlyWithAudio)),
    setIdentityAction: (identity) => dispatch(setIdentity(identity)),
    setRoomAction: (roomId) => dispatch(setRoomId(roomId)),
    setRoomPasswordAction: (roomPassword) => dispatch(setRoomPassword(roomPassword)),
  }
}

export default connect(mapStoreStateToProps, mapActionsToProps)(JoinRoomContent);
