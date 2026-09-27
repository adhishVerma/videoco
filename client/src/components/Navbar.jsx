import React from "react";
import { connect } from "react-redux";
import { toast } from "react-toastify";
import { FaRegCopy } from "react-icons/fa";

const Navbar = ({ roomId }) => {

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied to clipboard', { position: 'bottom-right', autoClose: 2000 });
  };

  return (
    <div className="z-50 fixed top-0 left-0 right-0 flex items-center bg-white/90 backdrop-blur border-b border-skin-primary">
      <nav className="flex items-center justify-between gap-3 py-2 px-4 lg:px-0 container m-auto">
        <a href="/" className="flex items-center shrink-0">
          <img src="/image.png" alt="logo" className="max-h-8 sm:max-h-10" />
        </a>
        {roomId && (
          <button
            onClick={copyRoomId}
            title="Copy room ID"
            className="flex items-center gap-2 min-w-0 text-xs sm:text-sm text-gray-600 bg-skin-secondary hover:bg-gray-200 transition-colors px-3 py-1.5 rounded-full max-w-[60%] sm:max-w-xs"
          >
            <span className="truncate">{roomId}</span>
            <FaRegCopy className="shrink-0" />
          </button>
        )}
      </nav>
    </div>
  );
};

const mapStoreStateToProps = (state) => {
  return { roomId: state.roomId };
};

export default connect(mapStoreStateToProps)(Navbar);
