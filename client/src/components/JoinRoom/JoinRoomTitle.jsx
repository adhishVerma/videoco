import React from 'react'

export const JoinRoomTitle = ({isRoomHost}) => {
  return (
    <div className='text-center mb-1'>
      <h1 className='text-2xl font-bold text-slate-900'>{isRoomHost ? 'Start a call' : 'Join a call'}</h1>
      <p className='mt-1 text-sm text-slate-500'>
        {isRoomHost ? "Pick a name and you'll get a link to share." : 'Enter the room ID you were sent.'}
      </p>
    </div>
  )
}
