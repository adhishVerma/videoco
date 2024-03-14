import React from 'react'
import ReactPlayer from "react-player";
import { FaUserCircle } from "react-icons/fa";


export const Video = ({ stream, muted, name }) => {

    const handleFullScreenStream = (event) => {
        const element = event.target
        if (element.classList.contains('fullscreen-stream')) {
          element.classList.remove('fullscreen-stream');
        } else {
          element.classList.add('fullscreen-stream');
        }
      }

    return (
        <div className='w-full h-full flex justify-center' onClick={handleFullScreenStream}>
            <div className='pointer-events-none rounded relative aspect-video max-w-full max-h-full lg:border border-skin-primary overflow-hidden shadow-md bg-black'>
                <div className='text-skin-btn-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'><FaUserCircle className='size-16' />
                </div>
                <ReactPlayer
                    height="100%"
                    width="100%"
                    url={stream}
                    playing
                    playsinline
                    muted={muted}
                    className="absolute top-0 left-0" />
                <div className="text-white absolute bottom-3 left-3 bg-[rgba(0,0,0,0.29)] p-2 px-3 rounded-md text-base">{name ? name : "guest"}</div>
            </div ></div>
    )
}
