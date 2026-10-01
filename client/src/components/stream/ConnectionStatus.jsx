import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { CALL_STATUS, STATUS_MESSAGES } from '../../utils/callStatus';

const FAILURE_COPY = {
    media: {
        title: "We couldn't use your camera or microphone",
        body: 'Check that no other app is using them and that this site is allowed to access them in your browser, then try again.',
    },
    connection: {
        title: "We couldn't connect to the call",
        body: 'The call server did not respond in time. Check your internet connection and try again.',
    },
};

// Never hides the user's own preview while connecting - progress is a small
// pill. Only a hard failure takes over the screen, and it always offers a
// way forward (retry) and a way out (leave).
const ConnectionStatus = ({ status, kind, onRetry, onLeave }) => {
    if (status === CALL_STATUS.CONNECTED) return null;

    if (status === CALL_STATUS.FAILED) {
        const copy = FAILURE_COPY[kind] || FAILURE_COPY.connection;
        return (
            <div role="alertdialog" aria-labelledby="call-failed-title" className="absolute inset-0 z-20 flex items-center justify-center bg-room-bg/80 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm rounded-2xl bg-room-raised border border-room-border p-6 text-center shadow-tile animate-slide-up">
                    <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-xl">
                        <FaExclamationTriangle />
                    </div>
                    <h2 id="call-failed-title" className="text-lg font-semibold text-white">{copy.title}</h2>
                    <p className="mt-2 text-sm text-slate-300">{copy.body}</p>
                    <div className="mt-6 flex gap-3 justify-center">
                        <Button variant="primary" onClick={onRetry}>Try again</Button>
                        <Button variant="secondary" onClick={onLeave} className="!bg-transparent !text-white !border-room-border hover:!bg-room-border">Leave</Button>
                    </div>
                </div>
            </div>
        );
    }

    const reconnecting = status === CALL_STATUS.RECONNECTING;
    return (
        <div
            role="status"
            aria-live="polite"
            className={`absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium shadow-tile animate-fade-in ${reconnecting ? 'bg-amber-500 text-slate-900' : 'bg-room-raised text-white border border-room-border'}`}
        >
            <Spinner decorative className="h-4 w-4" />
            {STATUS_MESSAGES[status] || 'Connecting...'}
        </div>
    );
};

export default ConnectionStatus;
