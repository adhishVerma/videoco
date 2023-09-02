import React, { useEffect } from "react";
import { useMedia } from "../../context/MediaStreamContext";
import Footer from "./Footer";
import { Video } from "./Video";


const Stream = () => {
  const { mute, localStream, setLocalStream, remoteStreams, setRemoteStreams } = useMedia();

  const handleFullScreenStream = (event) => {
    const element = event.target
    if (element.classList.contains('fullscreen-stream')) {
      element.classList.remove('fullscreen-stream');
    } else {
      element.classList.add('fullscreen-stream');
    }
  }


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


  return (
    <div className="h-full w-full">
      <div className='grid grid-cols-2 h-full w-full relative items-center justify-center'>
        {remoteStreams.map(r => {
          return <div className="h-full w-full max-h-96" key={r.id} onClick={handleFullScreenStream}><Video stream={r.stream} muted={mute} /></div>
        })}
        <div className="h-full w-full max-h-96" onClick={handleFullScreenStream}><Video stream={localStream} muted={true} name={"user"}/></div>
      </div>
      <Footer />
    </div>
  );
};

export default Stream;
