import React from 'react'
import { useMedia } from '../../context/MediaStreamContext';
import { BsDisplay, BsCamera } from 'react-icons/bs';

const constraints = {
    audio: false,
    video: true
}

export const ScreenSharingButton = () => {
    const { screenSharingStream, setScreenSharingStream, isScreenSharingActive, setIsScreenSharingActive, toggleScreenShare } = useMedia();

    const handleScreenSharing = async () => {
        if (!isScreenSharingActive) {
            let stream = null;

            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            } catch (err) {
                console.log(err)
            }

            if (stream) {
                setScreenSharingStream(stream);
                toggleScreenShare(isScreenSharingActive, stream);
                setIsScreenSharingActive(true);
                // execute func to switch the video track that we are sending to others.
            } 
        }else {
            toggleScreenShare(isScreenSharingActive);
            // swithc back to video camera
            setIsScreenSharingActive(false);

            // stop screen share stream
            screenSharingStream.getTracks().forEach((t) => t.stop());
            setScreenSharingStream(null);
        }
    }

    return (
        <button onClick={handleScreenSharing} className="bg-[rgba(255,255,255,0.17)] p-2 rounded-full opacity-50 hover:opacity-100 hover:scale-110">
            {!isScreenSharingActive ? <BsDisplay /> : <BsCamera />}
        </button>
    )
}
