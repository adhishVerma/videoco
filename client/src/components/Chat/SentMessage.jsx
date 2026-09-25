import React from 'react'
import { AttachmentPreview } from './AttachmentPreview'

export const SentMessage = (props) => {
    return (
        <div className='flex justify-end mb-2.5 text-white'>
            <div className='bg-skin-btn-primary break-normal text-wrap max-w-full py-1 px-2 rounded shadow-sm flex flex-col gap-1'>
                {props.attachment && <AttachmentPreview attachment={props.attachment} />}
                {props.message && <span>{props.message}</span>}
            </div>
        </div>
    )
}
