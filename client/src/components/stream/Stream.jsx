import React, { useEffect, useMemo, useState } from "react";
import { connect } from "react-redux";
import { useMedia } from "../../context/MediaStreamContext";
import { socket, removeParticipant } from "../../utils/wss";
import { CALL_STATUS } from "../../utils/callStatus";
import { Video } from "./Video";

const LOCAL_ID = 'local';

const Stream = ({ identity, participants, isRoomHost }) => {
  const { mute, localStream, setLocalStream, remoteStreams, setRemoteStreams, captions, callStatus } = useMedia();
  const [expandedId, setExpandedId] = useState(null);
  // socket id -> true when that person has told us their camera is off
  const [cameraOff, setCameraOff] = useState({});

  useEffect(() => {
    const handleLocalStream = (event) => {
      setLocalStream(event.detail.stream);
    }

    const handleRemoteStreams = (event) => {
      setRemoteStreams(event.detail.streams);
    }

    // Functional update, and no assumption the peer ever had a stream: this
    // used to look the stream up in a closed-over array and read .stream off
    // the result, which threw (and blanked the whole page) for a participant
    // who left before their video had arrived.
    const handleRemoveRemoteStream = (event) => {
      const { socketId } = event.detail;
      setRemoteStreams((current) => current.filter((stream) => stream.id !== socketId));
      setExpandedId((current) => (current === socketId ? null : current));
      setCameraOff((current) => {
        if (!(socketId in current)) return current;
        const { [socketId]: removed, ...rest } = current;
        return rest;
      });
    }

    const handleRemoteMediaState = (event) => {
      const { socketId, video } = event.detail || {};
      if (!socketId) return;
      setCameraOff((current) => ({ ...current, [socketId]: !video }));
    }

    window.addEventListener('remove-remote-stream', handleRemoveRemoteStream)
    window.addEventListener('remote-media-state', handleRemoteMediaState);
    window.addEventListener('catch-local-stream', handleLocalStream);
    window.addEventListener('catch-remote-stream', handleRemoteStreams);

    return () => {
      window.removeEventListener('remove-remote-stream', handleRemoveRemoteStream)
      window.removeEventListener('remote-media-state', handleRemoteMediaState);
      window.removeEventListener('catch-local-stream', handleLocalStream);
      window.removeEventListener('catch-remote-stream', handleRemoteStreams);
    }
  }, [setLocalStream, setRemoteStreams])

  const tiles = useMemo(() => {
    const nameOf = (socketId) => {
      const participant = participants.find((p) => p.socketId === socketId);
      return participant ? participant.identity : undefined;
    };
    return [
      ...remoteStreams.map((r) => ({ id: r.id, stream: r.stream, name: nameOf(r.id), isLocal: false })),
      { id: LOCAL_ID, stream: localStream, name: identity || 'You', isLocal: true },
    ];
  }, [remoteStreams, localStream, participants, identity]);

  const toggleExpand = (id) => setExpandedId((current) => (current === id ? null : id));

  const renderTile = (tile) => (
    <Video
      key={tile.id}
      stream={tile.stream}
      // your own tile is always muted - hearing yourself is an echo
      muted={tile.isLocal ? true : mute}
      name={tile.name}
      isLocal={tile.isLocal}
      cameraOff={!tile.isLocal && !!cameraOff[tile.id]}
      caption={captions[tile.isLocal ? socket && socket.id : tile.id]}
      expanded={expandedId === tile.id}
      onToggleExpand={tiles.length > 1 ? () => toggleExpand(tile.id) : undefined}
      onRemove={isRoomHost && !tile.isLocal ? () => removeParticipant(tile.id) : undefined}
    />
  );

  const expanded = tiles.find((t) => t.id === expandedId);
  const alone = remoteStreams.length === 0 && callStatus.status === CALL_STATUS.CONNECTED;

  if (expanded) {
    const others = tiles.filter((t) => t.id !== expanded.id);
    return (
      <div className="flex flex-col lg:flex-row gap-3 h-full w-full p-3">
        <div className="flex-1 min-h-0">{renderTile(expanded)}</div>
        <div className="flex lg:flex-col gap-3 h-28 lg:h-auto lg:w-60 overflow-auto shrink-0">
          {others.map((tile) => (
            <div key={tile.id} className="aspect-video h-full lg:h-auto lg:w-full shrink-0">{renderTile(tile)}</div>
          ))}
        </div>
      </div>
    );
  }

  const columns = tiles.length === 1
    ? 'grid-cols-1 max-w-4xl'
    : 'grid-cols-1 sm:grid-cols-2 max-w-6xl';

  return (
    <div className="h-full w-full overflow-y-auto p-3 flex flex-col items-center justify-center">
      <div className={`grid ${columns} gap-3 w-full`}>
        {tiles.map((tile) => (
          <div key={tile.id} className="aspect-video w-full max-h-[70vh] justify-self-center">{renderTile(tile)}</div>
        ))}
      </div>
      {alone && (
        <p className="mt-4 text-center text-sm text-slate-400">
          You're the only one here. Copy the invite link from the top bar to bring someone in.
        </p>
      )}
    </div>
  );
};

const mapStoreStateToProps = (state) => {
  return {
    identity: state.identity,
    participants: state.participants,
    isRoomHost: state.isRoomHost,
  }
}

export default connect(mapStoreStateToProps)(Stream);
