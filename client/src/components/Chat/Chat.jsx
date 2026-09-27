import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AiOutlineSend } from "react-icons/ai";
import { IoClose } from "react-icons/io5";
import { FaPaperclip } from "react-icons/fa";
import { SentMessage } from './SentMessage';
import { ReceivedMessage } from './ReceivedMessage';
import { v4 as uuidv4 } from 'uuid';
import { socket } from "../../utils/wss";
import * as api from "../../utils/api";
import { uploadAttachment } from "../../utils/attachments";
import { connect } from 'react-redux';
import { toast } from 'react-toastify';
import Button from '../ui/Button';


const Chat = (props) => {
    const { roomId, participants, onClose } = props;
    const chatContainer = useRef();
    const fileInputRef = useRef();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);

    useEffect(() => {
        api.getAttachmentsStatus()
            .then(({ enabled }) => setAttachmentsEnabled(enabled))
            .catch(() => setAttachmentsEnabled(false));
    }, []);

    const handleReceivedMessage = useCallback((data) => {
        const { message, messageId, attachment, socketId } = data;
        const identity = participants.find((participant) => participant.socketId === socketId).identity;
        const newMessage = <ReceivedMessage message={message} attachment={attachment} key={messageId} identity={identity} />;
        const copyMessages = [...messages];
        copyMessages.push(newMessage);
        setMessages(copyMessages);
    }, [messages, participants]);

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

    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    }

    const handleFileSelected = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        setUploading(true);
        try {
            const attachment = await uploadAttachment(file);
            const messageId = uuidv4();
            socket.emit("send-message", { roomId, message: { message: '', messageId, attachment } });
            const newMessage = <SentMessage key={messageId} attachment={attachment} />;
            setMessages((prev) => [...prev, newMessage]);
        } catch (err) {
            const errorText = err.response?.data?.error || err.message || 'Failed to send attachment';
            toast.error(errorText, { position: 'bottom-right' });
        } finally {
            setUploading(false);
        }
    }

    // socket programming messages.
    useEffect(() => {
        socket.on("receive-message", handleReceivedMessage);

        return () => {
            socket.off("receive-message", handleReceivedMessage);
        }
    }, [handleReceivedMessage]);


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
        <div className='flex flex-col p-2 relative h-full w-full gap-3'>
            <div className='flex items-center justify-between px-1'>
                <div className='text-lg font-medium text-gray-700'>Messages</div>
                {onClose && (
                    <Button variant='icon' onClick={onClose} title="Close chat" className="!min-w-[36px] !min-h-[36px] !bg-transparent !shadow-none">
                        <IoClose />
                    </Button>
                )}
            </div>
            <div className='overflow-clip flex-1 w-full'>
                <div className='overflow-y-scroll h-full' ref={chatContainer}>
                    <div className='chat-window h-full'>
                        {messages.map((item) => {
                            return item
                        })}
                    </div>
                </div>
            </div>
            <div className='bottom-0 left-0 right-0'>
                <form className='flex p-1 px-2 gap-2 w-full rounded bg-skin-secondary' onSubmit={handleSendMessage}>
                    {attachmentsEnabled && (
                        <>
                            <input
                                type='file'
                                ref={fileInputRef}
                                onChange={handleFileSelected}
                                className='hidden'
                            />
                            <Button
                                type='button'
                                variant='icon'
                                onClick={handleAttachmentClick}
                                title='Attach a file'
                                disabled={uploading}
                                className='!min-w-[40px] !min-h-[40px] shrink-0'
                            >
                                <FaPaperclip />
                            </Button>
                        </>
                    )}
                    <div className='flex-1 min-h-10 max-h-24'>
                        <input value={message} onChange={handleInput} type='text' placeholder={uploading ? 'Uploading attachment...' : 'Type a message'} disabled={uploading} className='resize-none outline-none px-3 w-full bg-skin-secondary p-2 rounded min-h-10 max-h-24' />
                    </div>
                    <Button type='submit' variant="icon" disabled={uploading}><AiOutlineSend /></Button>
                </form>
            </div>
        </div>
    )
}

const mapStoreStateToProps = (state) => {
    return {
        ...state
    }
}

export default connect(mapStoreStateToProps)(Chat);
