import React, { memo, useEffect, useRef, useState } from 'react'
import { FaUserSlash, FaExpand, FaCompress, FaPlay } from "react-icons/fa";

const hasLiveVideo = (stream) => {
    return !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled && !t.muted);
};

// Whether there's actually a picture to show. A camera that's turned off
// leaves a black rectangle (or a frozen last frame), so tiles show an avatar
// instead. `enabled` flips fire no event, and LiveKit swaps the tracks inside
// the SAME MediaStream object, so listening alone would miss changes - a
// light poll covers both.
export const useHasLiveVideo = (stream) => {
    const [hasVideo, setHasVideo] = useState(() => hasLiveVideo(stream));

    useEffect(() => {
        if (!stream) {
            setHasVideo(false);
            return undefined;
        }
        const update = () => setHasVideo(hasLiveVideo(stream));
        update();
        const interval = setInterval(update, 500);
        return () => clearInterval(interval);
    }, [stream]);

    return hasVideo;
};

const Avatar = ({ name }) => {
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return (
        <div className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-room-tile to-room-raised'>
            <div aria-hidden="true" className='w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-600/30 text-brand-200 ring-2 ring-brand-500/40 flex items-center justify-center text-4xl font-semibold select-none'>
                {initial}
            </div>
        </div>
    );
};

const TileButton = ({ title, onClick, className = '', children }) => (
    <button
        type='button'
        title={title}
        aria-label={title}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`text-white bg-black/50 hover:bg-black/70 backdrop-blur p-2 rounded-lg transition-colors ${className}`}
    >
        {children}
    </button>
);

const VideoTile = ({ stream, muted, name, caption, isLocal = false, cameraOff = false, expanded = false, onToggleExpand, onRemove }) => {
    const videoRef = useRef(null);
    const [playBlocked, setPlayBlocked] = useState(false);
    // a camera that was switched off on the sender's side still delivers
    // (black) frames, so the stream alone can't say it's off - `cameraOff` can
    const hasVideo = useHasLiveVideo(stream) && !cameraOff;

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        if (el.srcObject !== (stream || null)) el.srcObject = stream || null;
        if (!stream) return;
        // Browsers can refuse to autoplay sound that wasn't started by a
        // click. Say so, instead of leaving a silent tile that looks broken.
        const attempt = el.play && el.play();
        if (attempt && attempt.then) {
            attempt.then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true));
        }
    }, [stream]);

    // React doesn't reliably update the `muted` attribute after first render
    useEffect(() => {
        if (videoRef.current) videoRef.current.muted = !!muted;
    }, [muted]);

    const resume = () => {
        const attempt = videoRef.current && videoRef.current.play();
        if (attempt && attempt.then) attempt.then(() => setPlayBlocked(false)).catch(() => {});
    };

    const label = isLocal ? `${name || 'You'} (You)` : (name || 'Guest');

    return (
        <div
            data-testid='video-tile'
            onDoubleClick={onToggleExpand}
            className='group relative w-full h-full overflow-hidden rounded-2xl bg-room-tile border border-room-border shadow-tile'
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                aria-label={`${label} video`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${hasVideo ? 'opacity-100' : 'opacity-0'} ${isLocal ? '-scale-x-100' : ''}`}
            />
            {!hasVideo && <Avatar name={name} />}

            <div className='absolute top-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity'>
                {onRemove && (
                    <TileButton title='Remove from call' onClick={onRemove} className='hover:!bg-red-600/90'>
                        <FaUserSlash />
                    </TileButton>
                )}
                {onToggleExpand && (
                    <TileButton title={expanded ? 'Show everyone' : 'Focus on this person'} onClick={onToggleExpand}>
                        {expanded ? <FaCompress /> : <FaExpand />}
                    </TileButton>
                )}
            </div>

            {playBlocked && (
                <button
                    type='button'
                    onClick={resume}
                    className='absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white text-sm font-medium'
                >
                    <span className='w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center'><FaPlay /></span>
                    Click to start playback
                </button>
            )}

            {caption && (
                <div className='absolute bottom-12 left-1/2 -translate-x-1/2 max-w-[92%] bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm text-center'>
                    {caption}
                </div>
            )}

            <div className='absolute bottom-2.5 left-2.5 max-w-[80%] truncate bg-black/55 backdrop-blur text-white text-sm font-medium px-2.5 py-1 rounded-lg'>
                {label}
            </div>
        </div>
    )
}

// memo: with several tiles on screen, one participant's caption or one
// tile's state change shouldn't re-render all the others
export const Video = memo(VideoTile);
