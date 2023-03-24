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
        {
          urls: "stun:global.stun.twilio.com:3478",
        }
    ],
  }

  const peer = new RTCPeerConnection(config)

  const addStream = async (stream) => {
    stream.getTracks().forEach((track) =>
    {
    peer.addTrack(track, stream)
    });
  } 

  const toggleAudioTrack = (stream, value) => {
    stream.getAudioTracks()[0].enabled = value
  }

  const toggleVideoTrack = (stream,value) => {
    console.log(stream.getVideoTracks()[0], value)
    stream.getVideoTracks()[0].enabled= value
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
      value={{ config, peer, addStream, createOffer , createAnswer, toggleVideoTrack, toggleAudioTrack}}
    >
      {props.children}
    </PeerContext.Provider>
  );
  }
