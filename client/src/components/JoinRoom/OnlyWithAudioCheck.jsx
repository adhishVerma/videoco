import React from 'react';
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";


export const OnlyWithAudioCheck = (props) => {
    const {connectOnlyAudio, setConnectOnlyAudio} = props;
    const text = !connectOnlyAudio ? 'Join with voice' : 'Join Muted'

    const handleConnectionTypeChange = () => { 
        // change info in store
        setConnectOnlyAudio(!connectOnlyAudio);      
    }

    return (
        <div className='cursor-pointer w-full'>
            <div onClick={handleConnectionTypeChange} className=' flex items-center gap-3'>
                <div>{!connectOnlyAudio ? <FaMicrophone/> : <FaMicrophoneSlash />}</div>
                <span className='flex-1'>{text}</span>
            </div>
        </div>
    )
}
