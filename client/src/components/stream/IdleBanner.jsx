import React, { useEffect, useState } from 'react';
import { FaHourglassHalf } from 'react-icons/fa';
import Button from '../ui/Button';

const format = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Shown to a lone participant shortly before the server ends their empty
// room (see server/idle.js). Ending idle rooms is what stops an abandoned
// call from running up media-server usage - this gives them the chance to say
// "I'm still here".
const IdleBanner = ({ secondsLeft, onKeepOpen }) => {
    const [remaining, setRemaining] = useState(secondsLeft);

    useEffect(() => {
        setRemaining(secondsLeft);
        const interval = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(interval);
    }, [secondsLeft]);

    return (
        <div role="alert" className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-30 w-[min(92vw,34rem)] flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-amber-400 text-slate-900 px-4 py-3 shadow-tile animate-fade-in">
            <FaHourglassHalf className="shrink-0 text-lg" aria-hidden="true" />
            <p className="flex-1 text-sm font-medium text-center sm:text-left">
                No one else is here. This room closes in <span className="tabular-nums font-bold">{format(remaining)}</span>.
            </p>
            <Button variant="primary" onClick={onKeepOpen} className="!bg-slate-900 hover:!bg-slate-800 !py-1.5 shrink-0">Keep room open</Button>
        </div>
    );
};

export default IdleBanner;
