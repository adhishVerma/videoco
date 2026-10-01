import React, { useEffect, useRef, useState } from 'react'
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

const MAX_MESSAGE_LENGTH = 2000; // keep in sync with server/app.js

const playNotificationSound = (audio) => {
    // autoplay policies can reject this - a missing ping isn't worth surfacing
    try {
        const attempt = audio && audio.play();
        if (attempt && attempt.catch) attempt.catch(() => {});
    } catch (err) { /* no audio support */ }
};

const Chat = ({ roomId, participants, onClose, isOpen = true, onUnread }) => {
    const chatContainer = useRef();
    const fileInputRef = useRef();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);

    // Handlers that must stay registered across renders read the latest values
    // through refs, instead of re-subscribing to the socket on every message.
    const participantsRef = useRef(participants);
    participantsRef.current = participants;
    const isOpenRef = useRef(isOpen);
    isOpenRef.current = isOpen;
    const onUnreadRef = useRef(onUnread);
    onUnreadRef.current = onUnread;
    const soundRef = useRef(null);

    useEffect(() => {
        try {
            soundRef.current = new Audio('/bubble.mp3');
            soundRef.current.volume = 0.33;
        } catch (err) { /* no audio support */ }
    }, []);

    useEffect(() => {
        api.getAttachmentsStatus()
            .then(({ enabled }) => setAttachmentsEnabled(enabled))
            .catch(() => setAttachmentsEnabled(false));
    }, []);

    useEffect(() => {
        const handleReceivedMessage = ({ message, messageId, attachment, socketId }) => {
            // The sender can already be gone from the participants list by the
            // time their message lands (they left right after sending). This
            // used to read .identity off an undefined lookup and crash the page.
            const sender = participantsRef.current.find((p) => p.socketId === socketId);
            setMessages((prev) => [...prev, {
                id: messageId,
                own: false,
                identity: sender ? sender.identity : 'Someone',
                message,
                attachment,
            }]);
            playNotificationSound(soundRef.current);
            if (!isOpenRef.current && onUnreadRef.current) onUnreadRef.current();
        };

        socket.on("receive-message", handleReceivedMessage);
        return () => {
            socket.off("receive-message", handleReceivedMessage);
        }
    }, []);

    const handleSendMessage = (e) => {
        e.preventDefault();
        const text = message.trim();
        if (text.length < 1) {
            setMessage("")
            return;
        }
        const messageId = uuidv4();
        socket.emit("send-message", { roomId, message: { message: text, messageId } });
        setMessages((prev) => [...prev, { id: messageId, own: true, message: text }]);
        setMessage("");
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
            setMessages((prev) => [...prev, { id: messageId, own: true, attachment }]);
        } catch (err) {
            const errorText = err.response?.data?.error || err.message || 'Failed to send attachment';
            toast.error(errorText, { position: 'bottom-right' });
        } finally {
            setUploading(false);
        }
    }

    // keep the newest message in view, unless the user has scrolled up to read
    useEffect(() => {
        const el = chatContainer.current;
        if (!el) return;
        const { offsetHeight, scrollHeight, scrollTop } = el;
        if (scrollHeight <= scrollTop + offsetHeight + 120) {
            el.scrollTo(0, scrollHeight);
        }
    }, [messages, isOpen])

    return (
        <div className='flex flex-col p-3 relative h-full w-full gap-3 text-slate-100'>
            <div className='flex items-center justify-between px-1'>
                <h2 className='text-lg font-semibold'>Messages</h2>
                {onClose && (
                    <Button variant='icon' onClick={onClose} title="Close chat" className='!w-9 !h-9 !bg-transparent hover:!bg-room-border'>
                        <IoClose />
                    </Button>
                )}
            </div>
            <div className='flex-1 min-h-0 overflow-y-auto px-1' ref={chatContainer} role='log' aria-live='polite'>
                {messages.length === 0 && (
                    <p className='text-sm text-slate-400 text-center mt-8'>No messages yet. Say hello!</p>
                )}
                {messages.map((item) => (
                    item.own
                        ? <SentMessage key={item.id} message={item.message} attachment={item.attachment} />
                        : <ReceivedMessage key={item.id} identity={item.identity} message={item.message} attachment={item.attachment} />
                ))}
            </div>
            <form className='flex items-center gap-2 p-2 rounded-xl bg-room-bg border border-room-border' onSubmit={handleSendMessage}>
                {attachmentsEnabled && (
                    <>
                        <input
                            type='file'
                            ref={fileInputRef}
                            onChange={handleFileSelected}
                            className='hidden'
                            data-testid='file-input'
                        />
                        <Button
                            type='button'
                            variant='icon'
                            onClick={handleAttachmentClick}
                            title='Attach a file'
                            disabled={uploading}
                            className='!w-10 !h-10 shrink-0'
                        >
                            <FaPaperclip />
                        </Button>
                    </>
                )}
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    type='text'
                    maxLength={MAX_MESSAGE_LENGTH}
                    aria-label='Message'
                    placeholder={uploading ? 'Uploading attachment...' : 'Type a message'}
                    disabled={uploading}
                    className='flex-1 min-w-0 bg-transparent text-white placeholder:text-slate-500 outline-none px-2 py-2'
                />
                <Button type='submit' variant='icon' disabled={uploading || !message.trim()} title='Send message' className='!bg-brand-600 hover:!bg-brand-700 !w-10 !h-10 shrink-0'>
                    <AiOutlineSend />
                </Button>
            </form>
        </div>
    )
}

const mapStoreStateToProps = (state) => {
    return {
        roomId: state.roomId,
        participants: state.participants,
    }
}

export default connect(mapStoreStateToProps)(Chat);
