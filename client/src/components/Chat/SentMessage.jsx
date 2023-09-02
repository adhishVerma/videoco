import React from 'react'

export const SentMessage = (props) => {
    return (
        <div className='flex justify-end mb-2 text-white'>
            <div className='bg-blue-700 break-words max-w-full py-1 px-2 rounded-md'>{props.message}</div>
        </div>
    )
}
