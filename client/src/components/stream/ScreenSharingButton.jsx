import React from 'react'
import { toast } from 'react-toastify';
import { useMedia } from '../../context/MediaStreamContext';
import { MdScreenShare, MdStopScreenShare } from 'react-icons/md';
import Button from '../ui/Button';
import { isUsingLiveKit, setLiveKitScreenShareEnabled } from '../../utils/livekitHandler';

const constraints = {
    audio: false,
    video: true
}

const isScreenShareSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

// picking "Cancel" in the browser's share dialog rejects with this - that's
// the user changing their mind, not an error worth a toast
const isUserCancel = (err) => err && (err.name === 'NotAllowedError' || err.name === 'AbortError');

export const ScreenSharingButton = ({ disabled = false }) => {
    const { screenSharingStream, setScreenSharingStream, isScreenSharingActive, setIsScreenSharingActive, toggleScreenShare } = useMedia();

    // most mobile browsers don't support getDisplayMedia - hide the
    // control instead of showing a button that would silently fail.
    if (!isScreenShareSupported) return null;

    const stopMeshShare = (stream) => {
        toggleScreenShare(true);
        setIsScreenSharingActive(false);
        stream.getTracks().forEach((t) => t.stop());
        setScreenSharingStream(null);
    };

    const handleScreenSharing = async () => {
        // LiveKit captures and publishes the screen itself - no need to
        // call getDisplayMedia or manage the stream ourselves here.
        if (isUsingLiveKit()) {
            try {
                await setLiveKitScreenShareEnabled(!isScreenSharingActive);
                setIsScreenSharingActive(!isScreenSharingActive);
            } catch (err) {
                if (!isUserCancel(err)) {
                    console.log(err);
                    toast.error('Could not start screen sharing', { position: 'bottom-right' });
                }
            }
            return;
        }

        if (!isScreenSharingActive) {
            let stream = null;

            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            } catch (err) {
                if (!isUserCancel(err)) {
                    console.log(err);
                    toast.error('Could not start screen sharing', { position: 'bottom-right' });
                }
            }

            if (stream) {
                setScreenSharingStream(stream);
                toggleScreenShare(isScreenSharingActive, stream);
                setIsScreenSharingActive(true);
                // the browser's own "Stop sharing" bar ends the track without
                // going through this button - switch back when that happens
                stream.getVideoTracks()[0].addEventListener('ended', () => stopMeshShare(stream), { once: true });
            }
        } else if (screenSharingStream) {
            stopMeshShare(screenSharingStream);
        } else {
            setIsScreenSharingActive(false);
        }
    }

    return (
        <Button
            onClick={handleScreenSharing}
            variant="icon"
            disabled={disabled}
            aria-pressed={isScreenSharingActive}
            className={isScreenSharingActive ? '!bg-brand-600 hover:!bg-brand-700' : ''}
            title={isScreenSharingActive ? 'Stop sharing your screen' : 'Share your screen'}
        >
            {isScreenSharingActive ? <MdStopScreenShare /> : <MdScreenShare />}
        </Button>
    )
}
