import React from 'react'
import {BsTelephoneXFill, BsTelephonePlusFill} from 'react-icons/bs'


const Callrequest = ({pickCall,declineCall, incomingCall}) => {

  return (
    <div className='text-white absolute bg-[rgba(0,0,0,0.4)] h-screen w-screen flex justify-center items-center z-20'>
      <div className='bg-[rgba(255,255,255,0.95)] rounded-sm min-h-[350px] w-screen max-w-max text-black flex p-12  flex-col justify-between'>
        <div className='user info text-2xl font-bold mb-3'>Incoming call</div>
        <div className='text-2xl mb-3'>{incomingCall.from} is calling..</div>
      <div className='controls self-end flex w-full justify-between'>
        <button onClick={pickCall} className='animate-bounce rounded-full bg-green-500 p-3 text-sm hover:bg-green-600'><BsTelephonePlusFill className='text-white' /></button>
        <button onClick={declineCall} className='rounded-full bg-red-500 hover:bg-red-700 p-3 text-sm'><BsTelephoneXFill className='text-white' /></button>
      </div>
      </div>
    </div>
  )
}

export default Callrequest
