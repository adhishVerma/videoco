import { useEffect } from "react";
import Stream from "../components/Stream";
import { useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { usePeer } from "../context/PeerContext";
import { useCallback } from "react";
import { useMedia } from "../context/MediaStreamContext";
import Waiting from "../components/Waiting";
import { Chat } from "../components/Chat";

const Room = () => {
  let { roomId } = useParams();
  let { peer, addStream, createOffer, createAnswer, setRemoteDescription } = usePeer();
  const { socket } = useSocket();
  const { remoteStream, setRemoteStream, localStream, setLocalStream } =
    useMedia();

  // when a second user enters the room a call is initiated
  const handleCreateCall = useCallback(async () => {
    if (peer.connectionState === "connected") {
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    addStream(stream);
    try{
      const offer = await createOffer();
      socket.emit("video-offer", { roomId, offer });
    }catch(err){
      console.log(err);
    }
    setLocalStream(stream);

  }, [socket, createOffer, roomId, peer.connectionState, setLocalStream, addStream]);

  // when negotiation needed is triggered
  const handleNegotiationNeededEvent = useCallback(async () => {
    try{
      const offer = await createOffer();
      socket.emit("nego-offer", { roomId, offer });
    }catch(err){
      console.log(err);
    }

  }, [socket, roomId, createOffer]);

  const handleNegotiationNeededOffer = useCallback(async (data) => {
    const { offer } = data;
    try{
      const answer = await createAnswer(offer);
      socket.emit("nego-answer", { roomId, answer });
    }catch(err){
      console.log(err);
    }

  },[createAnswer, roomId, socket])

  const handleNegotiationNeededFinal = useCallback(async (data) => {
    const {ans} = data;
    try{
      await setRemoteDescription(ans);
    }catch(err){
      console.log(err);
    }
  }, [setRemoteDescription])

  // when the client recieves a video-offer
  const handleVideoOfferMsg = useCallback(
    async (data) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      })
      addStream(stream);
      const { offer } = data;
      try{
        const answer = await createAnswer(offer);
        socket.emit("video-answer", { roomId, answer });
      }catch(err){
        console.log(err);
      }
      setLocalStream(stream);
    },
    [socket, createAnswer, roomId, setLocalStream, addStream]
  );

  // when an answer arrives for video-offer
  const handleVideoAnswerMsg = useCallback(
    async (data) => {
      const { answer } = data;
      try{
        await setRemoteDescription(answer);
      }catch(err){
        console.log(err);
      }
    },
    [setRemoteDescription]
  );

  // gathering ice candidates
  const handleICECandidateEvent = useCallback(
    async (e) => {
      if (e.candidate) {
        socket.emit("new-ice-candidate", { roomId, candidate: e.candidate });
      }
    },
    [socket, roomId]
  );

  // getting the ice candidate from remote peer
  const handleNewIceCandidateMsg = useCallback(
    async (data) => {
      const { candidate } = data;
      await peer.addIceCandidate(candidate);
    },
    [peer]
  );

  // when the remote peer adds tracks to the stream
  const handleRemoteTracks = useCallback(
    async (e) => {
      const stream = e.streams[0];
      setRemoteStream(stream);    
    },
    [setRemoteStream]
  );


  // initializing various listeners
  useEffect(() => {
    socket.on("user-joined", handleCreateCall);
    socket.on("video-offer", handleVideoOfferMsg);
    socket.on("video-answer", handleVideoAnswerMsg);
    socket.on("new-ice-candidate", handleNewIceCandidateMsg);
    socket.on('nego-offer', handleNegotiationNeededOffer);
    socket.on('nego-final', handleNegotiationNeededFinal);

    peer.addEventListener("negotiationneeded", handleNegotiationNeededEvent);
    peer.addEventListener("icecandidate", handleICECandidateEvent);
    peer.addEventListener("track", handleRemoteTracks);

    return () => {
      socket.off("user-joined", handleCreateCall);
      socket.off("video-offer", handleVideoOfferMsg);
      socket.off("video-answer", handleVideoAnswerMsg);
      socket.off("new-ice-candidate", handleNewIceCandidateMsg);
      socket.off('nego-offer', handleNegotiationNeededOffer);
      socket.off('nego-final', handleNegotiationNeededFinal);

      peer.removeEventListener("negotiationneeded",handleNegotiationNeededEvent);
      peer.removeEventListener("icecandidate", handleICECandidateEvent);
      peer.removeEventListener("track", handleRemoteTracks);
    };
  }, [
    socket,
    peer,
    handleCreateCall,
    handleVideoOfferMsg,
    handleVideoAnswerMsg,
    handleNegotiationNeededEvent,
    handleNegotiationNeededOffer,
    handleNegotiationNeededFinal,
    handleICECandidateEvent,
    handleNewIceCandidateMsg,
    handleRemoteTracks,
    addStream,
    localStream
  ]);

  if (!remoteStream) {
    return (
      <div className="flex w-screen h-screen items-center justify-center">
        <Waiting />
      </div>
    )
  }

  return (
    <div className="flex w-screen container m-auto h-screen py-20 justify-center gap-2 px-2">
      <div className="flex-1 shrink">
      <Stream localStream={localStream} remoteStream={remoteStream}/></div>
      <div className="text-white hidden lg:block rounded-md px-2 overflow-hidden"><Chat /></div>
    </div>
  );
};

export default Room;
