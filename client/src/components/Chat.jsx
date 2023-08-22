import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Attachment } from './Attachment/Attachment'
import { AiOutlineSend } from "react-icons/ai";
import { useSocket } from '../context/SocketContext';
import { SentMessage } from './Chat/SentMessage';
import { ReceivedMessage } from './Chat/ReceivedMessage';
import { v4 as uuidv4 } from 'uuid';


export const Chat = () => {
    const { socket, roomId } = useSocket();
    const chatContainer = useRef();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");


    const handleReceivedMessage = useCallback((data) => {
        const { message, messageId } = data;
        const newMessage = <ReceivedMessage message={message} key={messageId} />;
        const copyMessages = [...messages];
        copyMessages.push(newMessage);
        setMessages(copyMessages);
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (message.trim().length < 1) {
            setMessage("")
            return;
        }
        const messageId = uuidv4();
        socket.emit("send-message", { roomId, message: { message, messageId } });
        const newMessage = <SentMessage message={message} key={messageId} />;
        const copyMessages = [...messages];
        copyMessages.push(newMessage);
        setMessage("");
        setMessages(copyMessages);
    }

    const handleInput = (e) => {
        setMessage(e.target.value);
    }

    // socket programming messages.
    useEffect(() => {
        socket.on("receive-message", handleReceivedMessage);

        return () => {
            socket.off("receive-message", handleReceivedMessage);
        }
    }, [socket, handleReceivedMessage]);


    // display of messages and scrolling of chat.
    const scroll = () => {
        const { offsetHeight, scrollHeight, scrollTop } = chatContainer.current;
        if (scrollHeight <= scrollTop + offsetHeight + 100) {
            chatContainer.current?.scrollTo(0, scrollHeight);
        }
    }

    useEffect(() => {
        scroll();
    }, [messages])

    return (
        <div className='flex flex-col rounded-md p-3 relative h-full w-full gap-5 bg-[#202329] max-w-sm'>
            <div className='text-2xl font-bold'>
                Messages
            </div>
            <div className='overflow-clip flex-1 w-full'>
                <div className='overflow-y-scroll h-full' ref={chatContainer}>
                    <div className='chat-window mt-6 h-full'>
                        {messages.map((item) => {
                            return item
                        })}
                    </div>
                </div>
            </div>
            <div className='bottom-0 bg-[#131313] left-0 right-0 rounded-md'>
                <div className='p-2'>
                    <form className='flex p-2 gap-2 w-full rounded-lg border border-[rgba(249,249,249,0.2)]' onSubmit={handleSendMessage}>
                        <div className='flex-1 shrink '>
                            <input value={message} onChange={handleInput} type='text' className='outline-none w-full  bg-transparent py-1 px-3 rounded-md' />
                        </div>
                        <button type='submit' className='bg-green-600 px-2 rounded-full text-sm'><AiOutlineSend /></button>
                    </form>
                </div>
                <div className='p-2'>
                    <div className='border border-dashed rounded-md overflow-hidden'><Attachment /></div>
                </div>
            </div>
        </div>
    )
}
