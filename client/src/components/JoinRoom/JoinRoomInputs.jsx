import React from 'react';
import Input from '../ui/Input';

export const JoinRoomInputs = (props) => {
    const {roomIdValue, setRoomIdValue, nameValue, setNameValue, isRoomHost} = props;

    const handleRoomIdValueChange = (event) => {
        setRoomIdValue(event.target.value);
    }

    const handleNameValueChange = (event) => {
        setNameValue(event.target.value);
    }

  return (
    <div className='flex flex-col gap-3 w-full'>
        {!isRoomHost && <Input placeholder={'Enter the roomId'} value={roomIdValue} changeHandler={handleRoomIdValueChange}/>}
        <Input placeholder={'Enter you name'} value={nameValue} changeHandler={handleNameValueChange}/>
    </div>
  )
}
