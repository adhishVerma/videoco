import React, { useEffect } from "react";
import { useMedia } from "../../context/MediaStreamContext";
import { socket } from "../../utils/wss";
import Footer from "./Footer";
import { Video } from "./Video";


const Stream = (props) => {
  const { mute, localStream, setLocalStream, remoteStreams, setRemoteStreams, captions } = useMedia();


  useEffect(() => {
    const handleLocalStream = (event) => {
      setLocalStream(event.detail.stream);
    }

    const handleRemoteStreams = (event) => {
      setRemoteStreams(event.detail.streams);
    }

    const handleRemoveRemoteStream = (event) => {
      const { socketId } = event.detail;
      const streamObj = remoteStreams.find(stream => stream.id === socketId);
      const stream = streamObj.stream;
      const tracks = stream.getTracks();
      tracks.forEach(t => t.stop());
      const updatedStreams = remoteStreams.filter((stream) => stream.id !== socketId);
      setRemoteStreams([...updatedStreams]);
    }

    window.addEventListener('remove-remote-stream', handleRemoveRemoteStream)
    window.addEventListener('catch-local-stream', handleLocalStream);
    window.addEventListener('catch-remote-stream', handleRemoteStreams);

    return () => {
      window.removeEventListener('remove-remote-stream', handleRemoveRemoteStream)
      window.removeEventListener('catch-local-stream', handleLocalStream);
      window.removeEventListener('catch-remote-stream', handleRemoteStreams);
    }
  }, [remoteStreams, setLocalStream, setRemoteStreams])

  // grid needs a column count for the whole tile count (remote streams + the
  // local tile below), not just the remote count, and it must be a whole
  // number - "grid-cols-1.41..." isn't a real Tailwind class and silently
  // does nothing, leaving the grid uncolumned for 3+ participants.
  const totalTiles = remoteStreams.length + 1;
  const gridColsCount = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(totalTiles))));

  // eslint-disable-next-line
  let gridOptions = [
    "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4",
    "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"
  ]

  return (
    <div className="h-full w-full">
      <div className={`grid grid-cols-1 sm:grid-cols-${gridColsCount} gap-2 h-full w-full relative items-center justify-center bg-skin-secondary px-2 overflow-y-auto`}>
        {remoteStreams.map(r => {
          return <div className="h-full w-full max-h-96" key={r.id} ><Video stream={r.stream} muted={mute} caption={captions[r.id]} /></div>
        })}
        <div className="h-full w-full max-h-96 rounded" ><Video stream={localStream} muted={true} name={"user"} caption={captions[socket.id]} /></div>
      </div>
      <Footer chatToggle={props.chatToggle} />
    </div>
  );
};

export default Stream;
