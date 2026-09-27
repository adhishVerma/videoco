import * as api from "./api";

let TURNIceServers = null;

export const fetchTURNCredentials = async () => {
    try {
        const response = await api.getTURNCredentials();
        if (response) {
            TURNIceServers = response
        }
    } catch (err) {
        // no TURN server reachable - fall back to STUN-only. This still
        // works for callers on the same network / without strict NATs, so
        // it shouldn't block the call from starting.
        console.log('failed to fetch TURN credentials, falling back to STUN only', err);
    }
    return TURNIceServers;
}

export const getTurnIceServers = () => {
    return TURNIceServers;
}