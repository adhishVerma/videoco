// Every call attempt gets a session id. Anything async in the join flow
// (camera, socket join, token, LiveKit connect) re-checks it after each
// await, so a user who leaves - or retries - while a step is still pending
// can't have that step quietly finish later and leave them connected to a
// room (and billed for it) from a screen they already closed.
let current = 0;

export class SessionCancelled extends Error {
    constructor() {
        super('call session cancelled');
        this.name = 'SessionCancelled';
    }
}

export const beginSession = () => {
    current += 1;
    return current;
};

export const endSession = () => {
    current += 1;
};

export const isCurrentSession = (id) => id === current;

export const ensureCurrent = (id) => {
    if (id !== current) throw new SessionCancelled();
};
