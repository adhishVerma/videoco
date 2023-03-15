import React from 'react'
import {BsTelephoneXFill, BsTelephonePlusFill} from 'react-icons/bs'


const Callrequest = ({pickCall,declineCall}) => {

  return (
    <div className='text-white absolute bg-[#00000033] h-screen w-screen flex justify-center items-center'>
      <div className='bg-[#ceccd3] rounded-md h-1/3 w-screen max-w-md text-black flex p-16 flex-col justify-between'>
        <div className='user info text-2xl'>Incoming call</div>
        <div className='text-xl'>User is calling</div>
      <div className='controls self-end flex w-full justify-between'>
        <button onClick={pickCall} className='rounded-full bg-green-500 p-4 hover:bg-green-600'><BsTelephonePlusFill /><span className='absolute -translate-x-6 translate-y-5'>pick up</span></button>
        <button onClick={declineCall} className='rounded-full bg-red-500 hover:bg-red-600 p-4'><BsTelephoneXFill /><span className='absolute -translate-x-6 translate-y-5'>decline</span></button>
      </div>
      </div>
    </div>
  )
}

export default Callrequest
