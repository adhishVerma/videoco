// "We couldn't reach or use the call server" - as opposed to a getUserMedia
// permission/device failure, so the UI can show an accurate message instead
// of always blaming the camera/mic.
export class CallConnectionError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'CallConnectionError';
        this.cause = cause;
    }
}

// The server refused the join (wrong password, no such room, full...).
// Room.jsx already shows the toast for the matching 'join-error' window
// event, so the flow just needs to stop quietly when it sees this.
export class JoinRejectedError extends Error {
    constructor(reason) {
        super(`join rejected: ${reason}`);
        this.name = 'JoinRejectedError';
        this.reason = reason;
    }
}
