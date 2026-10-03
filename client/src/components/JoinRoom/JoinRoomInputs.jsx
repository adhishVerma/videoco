import React from 'react';
import Input from '../ui/Input';

export const JoinRoomInputs = ({ roomIdValue, setRoomIdValue, nameValue, setNameValue, passwordValue, setPasswordValue, isRoomHost, showPassword, errors = {} }) => {
  return (
    <div className='flex flex-col gap-4 w-full'>
        {!isRoomHost && (
          <Input label='Room ID' name='roomId' autoComplete='off' placeholder='Paste the room ID' value={roomIdValue} changeHandler={(e) => setRoomIdValue(e.target.value)} error={errors.roomId} />
        )}
        <Input label='Your name' name='name' autoComplete='nickname' maxLength={50} autoFocus={isRoomHost || !!roomIdValue} placeholder='How should others see you?' value={nameValue} changeHandler={(e) => setNameValue(e.target.value)} error={errors.name} />
        {(isRoomHost || showPassword) && (
          <Input
            label={isRoomHost ? 'Room password (optional)' : 'Room password'}
            type='password'
            name='password'
            autoComplete='off'
            maxLength={128}
            placeholder={isRoomHost ? 'Leave empty for an open room' : 'This room is password protected'}
            value={passwordValue}
            changeHandler={(e) => setPasswordValue(e.target.value)}
            error={errors.password}
          />
        )}
    </div>
  )
}
