const Actions = {
    SET_IS_ROOM_HOST: "SET_IS_ROOM_HOST",
    SET_ONLY_AUDIO: "SET_ONLY_AUDIO",
    SET_IDENTITY: "SET_IDENTITY",
    SET_ROOM_ID: "SET_ROOM_ID",
    SET_PARTICIPANTS  : "SET_PARTICIPANTS",
}

export const setIsRoomHost = (isRoomHost) => {
    return {
        type: Actions.SET_IS_ROOM_HOST,
        isRoomHost
    };
};

export const setConnectOnlyAudio = (onlyWithAudio) => {
    return {
        type: Actions.SET_ONLY_AUDIO,
        onlyWithAudio
    }
}

export const setRoomId = (roomId) => {
    return {
        type: Actions.SET_ROOM_ID,
        roomId
    }
}

export const setIdentity = (identity) => {
    return {
        type: Actions.SET_IDENTITY,
        identity
    }
}

export const setParticipants = (participants) => {
    return {
        type : Actions.SET_PARTICIPANTS,
        participants
    }
}


export default Actions;