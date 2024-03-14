import React, { useEffect } from "react";
import { useMedia } from "../../context/MediaStreamContext";
import Footer from "./Footer";
import { Video } from "./Video";


const Stream = (props) => {
  const { mute, localStream, setLocalStream, remoteStreams, setRemoteStreams } = useMedia();


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

  let gridCols = (n) => {
    if (n <= 1) return 1
    return Math.sqrt(n);
  }

  // eslint-disable-next-line
  let gridOptions = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"]

  return (
    <div className="h-full w-full">
      <div className={`grid grid-cols-${gridCols(remoteStreams.length)} h-full w-full relative items-center justify-center bg-skin-secondary px-2`}>
        {remoteStreams.map(r => {
          return <div className="h-full w-full max-h-96" key={r.id} ><Video stream={r.stream} muted={mute} /></div>
        })}
        <div className="h-full w-full max-h-96 rounded" ><Video stream={localStream} muted={true} name={"user"} /></div>
      </div>
      <Footer chatToggle={props.chatToggle} />
    </div>
  );
};

export default Stream;
