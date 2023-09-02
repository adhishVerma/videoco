import React from 'react'

export const JoinRoomTitle = ({isRoomHost}) => {
    const title = isRoomHost ? 'Host' : 'Join'
  return (
    <h2 className='text-2xl font-bold text-slate-600'>{title}</h2>
  )
}
