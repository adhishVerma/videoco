import { useEffect } from "react";
import Stream from "../components/stream";
import { useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { usePeer } from "../context/PeerContext";
import { useCallback } from "react";
import { useMedia } from "../context/MediaStreamContext";

const Room = () => {
  let { roomId } = useParams();
  let { peer, addStream, createOffer, createAnswer } = usePeer();
  const { socket } = useSocket();
  const { remoteStream, setRemoteStream, localStream, setLocalStream } =
    useMedia();

  // function to get the camera and mic
  const getUserMediaStream = useCallback(async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    setLocalStream(localStream);
    addStream(localStream);
  }, [setLocalStream, addStream]);

  // when a second user enters the room a call is initiated
  const handleCreateCall = useCallback(async () => {
    console.log("call-initiated");
    const offer = await createOffer();
    socket.emit("video-offer", { roomId, offer });
  }, [socket, createOffer, roomId]);

  // when negotiation needed is triggered
  const handleNegotiationNeededEvent = useCallback(async () => {
    console.log("negotiation-initiated");
    const offer = await createOffer();
    socket.emit("video-offer", { roomId, offer });
  }, [socket, roomId, createOffer]);

  // when the client recieves a video-offer
  const handleVideoOfferMsg = useCallback(
    async (data) => {
      console.log("video-offer-received");
      const { offer } = data;
      const remoteSDP = new RTCSessionDescription(offer);
      const answer = await createAnswer(remoteSDP);
      socket.emit("video-answer", { roomId, answer });
    },
    [socket, createAnswer, roomId]
  );

  // when an answer arrives for video-offer
  const handleVideoAnswerMsg = useCallback(
    async (data) => {
      console.log("video-answer-received");
      const { answer } = data;
      const remoteSDP = new RTCSessionDescription(answer);
      await peer.setRemoteDescription(remoteSDP);
    },
    [peer]
  );

  // gathering ice candidates
  const handleICECandidateEvent = useCallback(
    async (e) => {
      if (e.candidate) {
        console.log("found new candidate");
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

  // getting user media stream and adding it to peer
  useEffect(() => {
    if (!localStream) {
      getUserMediaStream();
    }
  }, [getUserMediaStream, localStream]);

  // initializing various listeners
  useEffect(() => {
    socket.on("user-joined", handleCreateCall);
    socket.on("video-offer", handleVideoOfferMsg);
    socket.on("video-answer", handleVideoAnswerMsg);
    socket.on("new-ice-candidate", handleNewIceCandidateMsg);

    peer.addEventListener("negotiationneeded", handleNegotiationNeededEvent);
    peer.addEventListener("icecandidate", handleICECandidateEvent);
    peer.addEventListener("track", handleRemoteTracks);

    return () => {
      socket.off("user-joined", handleCreateCall);
      socket.off("video-offer", handleVideoOfferMsg);
      socket.off("video-answer", handleVideoAnswerMsg);
      socket.off("new-ice-candidate", handleNewIceCandidateMsg);

      peer.removeEventListener(
        "negotiationneeded",
        handleNegotiationNeededEvent
      );
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
    handleICECandidateEvent,
    handleNewIceCandidateMsg,
    handleRemoteTracks,
  ]);

  return (
    <div>
      <Stream localStream={localStream} remoteStream={remoteStream}/>
    </div>
  );
};

export default Room;
