import * as api from "./api";

let TURNIceServers = null;

export const fetchTURNCredentials = async () => {
    const response = await api.getTURNCredentials();
    if(response){
        TURNIceServers = response
    }
    return TURNIceServers;
}

export const getTurnIceServers = () => {
    return TURNIceServers;
}