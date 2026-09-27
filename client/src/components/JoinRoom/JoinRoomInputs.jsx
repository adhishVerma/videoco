import React from 'react';
import Input from '../ui/Input';

export const JoinRoomInputs = (props) => {
    const {roomIdValue, setRoomIdValue, nameValue, setNameValue, passwordValue, setPasswordValue, isRoomHost} = props;

    const handleRoomIdValueChange = (event) => {
        setRoomIdValue(event.target.value);
    }

    const handleNameValueChange = (event) => {
        setNameValue(event.target.value);
    }

    const handlePasswordValueChange = (event) => {
        setPasswordValue(event.target.value);
    }

  return (
    <div className='flex flex-col gap-3 w-full'>
        {!isRoomHost && <Input placeholder={'Enter the roomId'} value={roomIdValue} changeHandler={handleRoomIdValueChange}/>}
        <Input placeholder={'Enter you name'} value={nameValue} changeHandler={handleNameValueChange}/>
        <Input type='password' placeholder={isRoomHost ? 'Room password (optional)' : 'Room password (if required)'} value={passwordValue} changeHandler={handlePasswordValueChange}/>
    </div>
  )
}
