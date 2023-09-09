import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { connect } from 'react-redux';
import { setIsRoomHost } from '../../store/actions';
import { JoinRoomTitle } from './JoinRoomTitle';
import JoinRoomContent from './JoinRoomContent';

const JoinRequest = (props) => {
  const { setIsRoomHostAction, isRoomHost } = props;
  const search = useLocation().search;
  

  useEffect(() => {
    const isRoomHost = new URLSearchParams(search).get('host');
    if (isRoomHost) {
      // marking ourself as host in redux store
      setIsRoomHostAction(true);
    }
  }, [search, setIsRoomHostAction])


  return (
    <div className='absolute flex justify-center items-center top-0 left-0 right-0 bottom-0'>
      <div className='flex flex-col items-center w-full max-w-[400px] gap-4 p-8 shadow-md rounded-md border'>
        <JoinRoomTitle isRoomHost={isRoomHost} />
        <JoinRoomContent />
      </div>
    </div>
  )
}

const mapStoreStateToProps = (state) => {
  return {
    ...state
  }
}

const mapActionsToProps = (dispatch) => {
  return {
    setIsRoomHostAction: (isRoomHost) => dispatch(setIsRoomHost(isRoomHost))
  };
};

export default connect(mapStoreStateToProps, mapActionsToProps)(JoinRequest);