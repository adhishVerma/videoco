import Actions from "./actions";

const initState = {
    identity: '',
    isRoomHost : false,
    connectOnlyAudio : false,
    roomId : null,
    participants : [],
};

const reducer = (state = initState, action) => {
    switch (action.type) {
        case Actions.SET_IS_ROOM_HOST:
            return {
                ...state,
                isRoomHost : action.isRoomHost
            };
        case Actions.SET_ONLY_AUDIO:
            return {
                ...state,
                connectOnlyAudio : action.onlyWithAudio
            };
        case Actions.SET_ROOM_ID:
            return{
                ...state,
                roomId : action.roomId
            };
        case Actions.SET_IDENTITY:
            return {
                ...state,
                identity : action.identity
            }
        case Actions.SET_PARTICIPANTS:
            return {
                ...state,
                participants : action.participants
            }

        default:
            return state;
    }
}

export default reducer;