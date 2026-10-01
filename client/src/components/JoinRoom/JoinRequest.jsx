import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { connect } from 'react-redux';
import { setIsRoomHost } from '../../store/actions';
import { JoinRoomTitle } from './JoinRoomTitle';
import JoinRoomContent from './JoinRoomContent';

const JoinRequest = ({ setIsRoomHostAction, isRoomHost }) => {
  const search = useLocation().search;

  useEffect(() => {
    // Set it both ways from the URL. It used to only ever switch ON, so
    // opening an invite link in a tab that had earlier hosted a room would
    // still behave as a host and create a brand new room instead of joining.
    setIsRoomHostAction(!!new URLSearchParams(search).get('host'));
  }, [search, setIsRoomHostAction])

  return (
    <main className='min-h-screen flex items-center justify-center px-4 pt-20 pb-10 bg-gradient-to-b from-brand-50 to-white'>
      <div className='w-full max-w-md bg-white rounded-2xl shadow-xl shadow-brand-600/5 border border-slate-200 p-6 sm:p-8 flex flex-col gap-6'>
        <JoinRoomTitle isRoomHost={isRoomHost} />
        <JoinRoomContent />
      </div>
    </main>
  )
}

const mapStoreStateToProps = (state) => {
  return {
    isRoomHost: state.isRoomHost
  }
}

const mapActionsToProps = (dispatch) => {
  return {
    setIsRoomHostAction: (isRoomHost) => dispatch(setIsRoomHost(isRoomHost))
  };
};

export default connect(mapStoreStateToProps, mapActionsToProps)(JoinRequest);
