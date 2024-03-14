import React from 'react'

export const JoinRoomTitle = ({isRoomHost}) => {
    const title = isRoomHost ? 'Host' : 'Join'
  return (
    <h2 className='text-2xl font-semibold text-slate-700'>{title}</h2>
  )
}
