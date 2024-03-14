import React from 'react'

export const SentMessage = (props) => {
    return (
        <div className='flex justify-end mb-2.5 text-white'>
            <div className='bg-skin-btn-primary break-normal text-wrap max-w-full py-1 px-2 rounded shadow-sm'>{props.message}</div>
        </div>
    )
}
