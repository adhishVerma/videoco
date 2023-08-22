import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";

// using context api we create a context
export const PeerContext = createContext();

// creating custom hook to use Peer Context everywhere
export const usePeer = () => {
  return useContext(PeerContext);
};

// setting up peer provider
export const PeerProvider = (props) => {
    const [iceServers, setIceServers] = useState([]);
    const [dataChannel, setDataChannel] = useState();
    
    useEffect(() => {
      const getIce = async() => {
        const iceservers = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/ice`)
        setIceServers(iceservers.data.slice(0,2));
      }
      getIce()
    }, [setIceServers])
    
    const config = { iceServers : iceServers  }

    const peer = useRef(new RTCPeerConnection(config));
    
  const addStream = async (stream) => {
    stream.getTracks().forEach((track) =>
    {
    peer.current.addTrack(track, stream)
    });
  } 

  const toggleAudioTrack = (stream, value) => {
    stream.getAudioTracks()[0].enabled = value
  }

  const toggleVideoTrack = (stream,value) => {
    stream.getVideoTracks()[0].enabled= value
  }

  const createOffer = async () => {
    const channel = peer.current.createDataChannel("file-transfer", {
      maxPacketLifeTime : 6000
    });
    setDataChannel(channel);
    const offer = await peer.current.createOffer();
    await peer.current.setLocalDescription(offer);
    return offer
  }

  const createAnswer = async (offer) => {
    await peer.current.setRemoteDescription(offer);
    const answer = await peer.current.createAnswer();
    await peer.current.setLocalDescription(new RTCSessionDescription(answer));
    return answer
  }

  const setRemoteDescription = async(ans) => {
    await peer.current.setRemoteDescription(new RTCSessionDescription(ans));
  }



  return (
    <PeerContext.Provider
      value={{ peer : peer.current, addStream, createOffer , createAnswer, toggleVideoTrack, toggleAudioTrack, setRemoteDescription, dataChannel, setDataChannel}}
    >
      {props.children}
    </PeerContext.Provider>
  );
  }
