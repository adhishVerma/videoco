import React from 'react'
import { AttachmentPreview } from './AttachmentPreview'

export const SentMessage = ({ message, attachment }) => {
    return (
        <div className='flex justify-end mb-3'>
            <div className='max-w-[85%] bg-brand-600 text-white break-words py-2 px-3 rounded-2xl rounded-br-md shadow-sm flex flex-col gap-1.5'>
                {attachment && <AttachmentPreview attachment={attachment} />}
                {message && <span className='whitespace-pre-wrap'>{message}</span>}
            </div>
        </div>
    )
}
