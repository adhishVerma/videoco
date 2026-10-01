import axios from 'axios';

const url = `${process.env.REACT_APP_BACKEND_URL}`

// Every request gets a timeout - axios has none by default, so a server that
// accepts the connection and then never answers would hang the caller (and
// anything awaiting it, like joining a call) indefinitely.
const REQUEST_TIMEOUT_MS = 8000;
const options = { timeout: REQUEST_TIMEOUT_MS };

export const getRoomExists = async (roomId) => {
    const response = await axios.get(`${url}/api/room-exists/${encodeURIComponent(roomId)}`, options);
    return response.data;
}

export const getTURNCredentials = async () => {
    const response = await axios.get(`${url}/ice`, options);
    return response.data;
  };

export const getAttachmentsStatus = async () => {
    const response = await axios.get(`${url}/api/attachments-status`, options);
    return response.data;
};

export const getUploadUrl = async (fileName, contentType, fileSize) => {
    const response = await axios.post(`${url}/api/upload-url`, { fileName, contentType, fileSize }, options);
    return response.data;
};

export const getLiveKitStatus = async () => {
    const response = await axios.get(`${url}/api/livekit-status`, options);
    return response.data;
};
