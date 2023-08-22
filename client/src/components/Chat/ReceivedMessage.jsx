import React from 'react'
import ReactHowler from 'react-howler'

export const ReceivedMessage = (props) => {
    return (
        <>
            <div className='flex mb-2'>
                <div className='bg-gray-700 break-words max-w-full py-1 px-2 rounded-md'>{props.message}</div>
            </div>
            <ReactHowler src={"/bubble.mp3"} volume={0.44} preload={true} playing={true} />
        </>
    )
}

