import React from 'react'
import { useMedia } from '../../context/MediaStreamContext';
import { BsDisplay, BsCamera } from 'react-icons/bs';
import Button from '../ui/Button';
import { isUsingLiveKit, setLiveKitScreenShareEnabled } from '../../utils/livekitHandler';

const constraints = {
    audio: false,
    video: true
}

const isScreenShareSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

export const ScreenSharingButton = () => {
    const { screenSharingStream, setScreenSharingStream, isScreenSharingActive, setIsScreenSharingActive, toggleScreenShare } = useMedia();

    // most mobile browsers don't support getDisplayMedia - hide the
    // control instead of showing a button that would silently fail.
    if (!isScreenShareSupported) return null;

    const handleScreenSharing = async () => {
        // LiveKit captures and publishes the screen itself - no need to
        // call getDisplayMedia or manage the stream ourselves here.
        if (isUsingLiveKit()) {
            try {
                await setLiveKitScreenShareEnabled(!isScreenSharingActive);
                setIsScreenSharingActive(!isScreenSharingActive);
            } catch (err) {
                console.log(err);
            }
            return;
        }

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
        <Button onClick={handleScreenSharing} variant="icon">
            {!isScreenSharingActive ? <BsDisplay /> : <BsCamera />}
        </Button>
    )
}
