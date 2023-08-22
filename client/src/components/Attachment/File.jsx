import React from 'react';
import {AiOutlineSend} from "react-icons/ai";
import {MdCancel} from "react-icons/md"

export const File = (props) => {
  return (
    <div className='w-full h-full p-4 gap-3 flex justify-between'>
        <div className='my-1 flex-1 overflow-clip whitespace-nowrap'>{props.name}</div>
        <button onClick={props.handleSend} className='bg-blue-700 px-2 rounded-full text-sm'><AiOutlineSend /></button>
        <button onClick={props.clearFile} className='px-2 bg-red-600 rounded-full text-sm'><MdCancel/></button>
    </div>
  )
}
