import React from 'react'
import ReactHowler from 'react-howler'
import { AttachmentPreview } from './AttachmentPreview'

export const ReceivedMessage = (props) => {
    return (
        <>
            <div className='bg-gray-700 w-max py-1 px-2 rounded mb-2.5'>
                <p className='text-xs mb-1 text-gray-200'>{props.identity}</p>
                <div className='text-white hadow-sm flex flex-col gap-1'>
                    {props.attachment && <AttachmentPreview attachment={props.attachment} />}
                    {props.message && <div className='text-wrap break-normal max-w-full'>{props.message}</div>}
                </div>
                <ReactHowler src={"/bubble.mp3"} volume={0.33} preload={true} playing={true} />
            </div></>
    )
}

