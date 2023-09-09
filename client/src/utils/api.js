import axios from 'axios';

const url = `${process.env.REACT_APP_BACKEND_URL}`

export const getRoomExists = async (roomId) => {
    const response = await axios.get(`${url}/api/room-exists/${roomId}`);
    return response.data;
}

export const getTURNCredentials = async () => {
    const response = await axios.get(`${url}/ice`);
    return response.data;
  };
