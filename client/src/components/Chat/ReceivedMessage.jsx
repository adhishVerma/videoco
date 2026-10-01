import React from 'react'
import { AttachmentPreview } from './AttachmentPreview'

export const ReceivedMessage = ({ identity, message, attachment }) => {
    return (
        <div className='flex justify-start mb-3'>
            <div className='max-w-[85%] bg-room-border text-slate-100 break-words py-2 px-3 rounded-2xl rounded-bl-md shadow-sm'>
                <p className='text-xs font-semibold mb-1 text-brand-200'>{identity}</p>
                <div className='flex flex-col gap-1.5'>
                    {attachment && <AttachmentPreview attachment={attachment} />}
                    {message && <span className='whitespace-pre-wrap'>{message}</span>}
                </div>
            </div>
        </div>
    )
}
