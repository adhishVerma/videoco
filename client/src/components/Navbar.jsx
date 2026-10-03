import React from "react";
import { connect } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { FaLink } from "react-icons/fa";

export const buildInviteLink = (roomId) => `${window.location.origin}/join-room?room=${encodeURIComponent(roomId)}`;

const Navbar = ({ roomId }) => {
  const { pathname } = useLocation();
  // the call room is dark; everywhere else is light
  const inRoom = pathname === '/room';

  const copyInvite = async () => {
    if (!roomId) return;
    const link = buildInviteLink(roomId);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied', { position: 'bottom-right', autoClose: 2000 });
    } catch (err) {
      // clipboard is unavailable in some contexts (insecure origins, denied
      // permission) - show the link so it can still be copied by hand
      toast.info(`Share this link: ${link}`, { position: 'bottom-right', autoClose: 10000 });
    }
  };

  return (
    <header className={`z-50 fixed top-0 left-0 right-0 backdrop-blur border-b ${inRoom ? 'bg-room-bg/90 border-room-border' : 'bg-white/90 border-slate-200'}`}>
      <nav className="flex items-center justify-between gap-3 h-14 px-4 max-w-7xl mx-auto">
        <Link to="/" aria-label="Videoco home" className={`text-xl font-bold tracking-tight ${inRoom ? 'text-white' : 'text-slate-900'}`}>
          video<span className="text-brand-500">co</span>
        </Link>
        {inRoom && roomId && (
          <button
            onClick={copyInvite}
            title="Copy invite link"
            className="flex items-center gap-2 min-w-0 text-xs sm:text-sm text-slate-200 bg-room-raised hover:bg-room-border transition-colors px-3 py-1.5 rounded-full max-w-[65%] sm:max-w-xs"
          >
            <FaLink className="shrink-0 text-brand-400" />
            <span className="truncate">Copy invite link</span>
            <span className="hidden sm:inline truncate text-slate-400">{roomId.slice(0, 8)}</span>
          </button>
        )}
      </nav>
    </header>
  );
};

const mapStoreStateToProps = (state) => {
  return { roomId: state.roomId };
};

export default connect(mapStoreStateToProps)(Navbar);
