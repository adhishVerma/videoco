// Connection progress, broadcast on the same window-CustomEvent bus the
// streams use so the UI doesn't care whether LiveKit or the mesh is active.
export const CALL_STATUS = {
    STARTING: 'starting',         // asking the server how to connect
    MEDIA: 'media',               // waiting on camera/mic (maybe a permission prompt)
    JOINING: 'joining',           // entering the room
    CONNECTING: 'connecting',     // connecting to the media server
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting', // media server dropped us and is retrying
    FAILED: 'failed',
};

export const STATUS_MESSAGES = {
    [CALL_STATUS.STARTING]: 'Starting call...',
    [CALL_STATUS.MEDIA]: 'Waiting for camera and microphone...',
    [CALL_STATUS.JOINING]: 'Joining room...',
    [CALL_STATUS.CONNECTING]: 'Connecting...',
    [CALL_STATUS.RECONNECTING]: 'Connection lost - reconnecting...',
};

export const setCallStatus = (status, detail = {}) => {
    window.dispatchEvent(new CustomEvent('call-status', { detail: { status, ...detail } }));
};

// the call is over and the user should be taken out of the room
export const endCall = (reason) => {
    window.dispatchEvent(new CustomEvent('call-ended', { detail: { reason } }));
};
