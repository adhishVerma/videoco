import React from 'react'
import {BsTelephoneXFill, BsTelephonePlusFill} from 'react-icons/bs'


const Callrequest = ({pickCall,declineCall, incomingCall}) => {

  return (
    <div className='text-white absolute bg-[#0000005e] h-screen w-screen flex justify-center items-center z-20'>
      <div className='bg-[#efeef3] rounded-md min-h-[350px] w-screen max-w-sm text-black flex p-16 flex-col justify-between'>
        <div className='user info text-2xl mb-3'>Incoming call</div>
        <div className='text-xl mb-3'>{incomingCall.from} is calling</div>
      <div className='controls self-end flex w-full justify-between'>
        <button onClick={pickCall} className='rounded-full bg-green-500 p-4 hover:bg-green-600'><BsTelephonePlusFill /><span className='absolute -translate-x-6 translate-y-5'>pick up</span></button>
        <button onClick={declineCall} className='rounded-full bg-red-400 hover:bg-red-500 p-4'><BsTelephoneXFill /><span className='absolute -translate-x-6 translate-y-5'>decline</span></button>
      </div>
      </div>
    </div>
  )
}

export default Callrequest
