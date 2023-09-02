import React from 'react'
import ReactPlayer from "react-player";



export const Video = ({ stream, muted, name }) => {

    return (
        <div className='pointer-events-none rounded-md relative w-full h-full lg:border border-[rgba(255,255,255,0.39)] overflow-hidden shadow-md bg-black'>
            <ReactPlayer
                height="100%"
                width="100%"
                url={stream}
                playing
                playsinline
                muted={muted}
                className="absolute top-0 left-0"/>
            <div className="text-white absolute bottom-3 left-3 bg-[rgba(0,0,0,0.29)] p-2 px-3 rounded-md text-base">{name? name : "guest"}</div>
        </div >
    )
}
