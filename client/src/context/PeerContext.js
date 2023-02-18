import React, { createContext, useContext } from "react";

// using context api we create a context
export const PeerContext = createContext();

// creating custom hook to use Peer Context everywhere
export const usePeer = () => {
  return useContext(PeerContext);
};

// setting up peer provider
export const PeerProvider = (props) => {
  const config = {
    iceServers: [
      { url: "stun:stun.sipgate.net:3478" },
      { url: "stun:stun1.l.google.com:19305" }
    ],
  }

  const peer = new RTCPeerConnection(config)

  const addStream = async (stream) => {
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  } 

  const createOffer = async () => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    return offer
  }

  const createAnswer = async (offer) => {
    await peer.setRemoteDescription(offer)
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    return answer
  }

  return (
    <PeerContext.Provider
      value={{ config, peer, addStream, createOffer , createAnswer}}
    >
      {props.children}
    </PeerContext.Provider>
  );
  }
