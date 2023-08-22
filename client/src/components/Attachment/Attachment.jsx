import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { FiUpload } from "react-icons/fi";
import { usePeer } from '../../context/PeerContext';
import { File } from './File';
import download from "downloadjs";

export const Attachment = () => {
    const { peer, dataChannel, setDataChannel } = usePeer(); // For dataChannel
    const CHUNK_SIZE = 16 * 1024;
    const [file, setFile] = useState();
    let fileChunks = useMemo(() => [], []);

    const handleFileSelect = (e) => {
        createDataChannel();
        setFile(e.target.files[0]);
    }

    const clearFile = (e) => {
        setFile("");
    }

    const createDataChannel = () => {
        const channel = peer.createDataChannel("file-transfer");
        setDataChannel(channel);
    }


    const handleSend = (e) => {
        if (dataChannel) {
            readFile(file);
        }
        setFile("");
    }

    const handleRemoteDataChannel = useCallback((e) => {
        const channel = e.channel;
        setDataChannel(channel);
    }, [setDataChannel]);

    const readFile = (file) => {
        const reader = new FileReader();
        reader.addEventListener('load', (e) => {
            let buffer = e.target.result;
            while (buffer.byteLength) {
                const chunk = buffer.slice(0, CHUNK_SIZE);
                buffer = buffer.slice(CHUNK_SIZE, buffer.byteLength);
                dataChannel.send(chunk);
            }
            dataChannel.send(JSON.stringify({ filename: file.name, filetype: file.type, status: "complete" }));
        })

        reader.addEventListener('progress', (e) => {
            if (e.loaded && e.total) {
                const percent = (e.loaded / e.total) * 100;
                console.log(`progress : ${percent}`);
            }
        })
        reader.readAsArrayBuffer(file);
    }


    const handleMessage = useCallback((e) => {
        let message = e.data;
        try {
            message = JSON.parse(message);
            if (message.status === "complete") {
                const { filename, filetype } = message;
                const file = new Blob(fileChunks);
                download(file, filename, filetype);
                dataChannel.close();
                setDataChannel(null);
            } 
        } catch (err) {
            console.log(err);
        }
        fileChunks.push(e.data);
    }, [fileChunks, setDataChannel, dataChannel]);

    useEffect(() => {
        peer.addEventListener('datachannel', handleRemoteDataChannel);
        if (dataChannel) {
            dataChannel.addEventListener('message', handleMessage);
        }

        return () => {
            peer.removeEventListener('datachannel', handleRemoteDataChannel)
            if (dataChannel) {
                dataChannel.removeEventListener('message', handleMessage);
            }
        }
    }, [peer, handleRemoteDataChannel, dataChannel, handleMessage])

    return (
        <div className='w-full h-full hover:bg-[rgba(255,255,255,0.3)]'>
            {file && <File name={file.name} handleSend={handleSend} clearFile={clearFile} />}
            {!file && <div className='w-full h-full'>
                <label htmlFor='file-upload' className='hover:cursor-pointer'>
                    <div className='h-full flex justify-center'>
                        <FiUpload className='m-6' />
                    </div>
                </label>
                <input id='file-upload' value={file} onChange={handleFileSelect} type='file' className='hidden'></input></div>}
        </div>
    )
}
