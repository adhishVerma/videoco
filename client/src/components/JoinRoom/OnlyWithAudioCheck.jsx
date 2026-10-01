import React from 'react';

// "Audio only" is what this actually does (the camera stays off until turned
// on in the call); it used to be labelled "Join Muted" with a mic icon,
// which suggested the opposite.
export const OnlyWithAudioCheck = ({ connectOnlyAudio, setConnectOnlyAudio }) => {
    return (
        <label className='flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none'>
            <input
                type='checkbox'
                checked={!!connectOnlyAudio}
                onChange={(e) => setConnectOnlyAudio(e.target.checked)}
                className='h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500'
            />
            Join with my camera off
        </label>
    )
}
