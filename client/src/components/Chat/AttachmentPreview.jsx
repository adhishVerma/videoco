import React from 'react'
import { FaFileDownload, FaFilePdf, FaFileAlt } from "react-icons/fa";

const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The attachment comes from another participant. A "javascript:" or "data:"
// URL in an <a href> would run script when clicked, so only ever render
// plain http(s) links (the server rejects the rest too - this is the second
// layer, in case a message arrives some other way).
export const isSafeUrl = (value) => {
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch (err) {
        return false;
    }
};

const FileCard = ({ attachment, icon }) => (
    <a
        href={attachment.url}
        target='_blank'
        rel='noreferrer noopener'
        className='flex items-center gap-2 bg-black/20 hover:bg-black/30 transition-colors rounded-lg px-2.5 py-2 max-w-[220px]'
    >
        {icon}
        <span className='flex-1 min-w-0'>
            <span className='block truncate text-sm'>{attachment.name}</span>
            {attachment.size ? <span className='block text-xs opacity-70'>{formatSize(attachment.size)}</span> : null}
        </span>
    </a>
);

export const AttachmentPreview = ({ attachment }) => {
    if (!attachment || !attachment.url || !isSafeUrl(attachment.url)) return null;

    const type = attachment.type || '';

    if (type.startsWith('image/')) {
        return (
            <a href={attachment.url} target='_blank' rel='noreferrer noopener' className='block max-w-[220px]'>
                <img src={attachment.url} alt={attachment.name} loading='lazy' className='rounded-lg max-h-52 w-auto' />
            </a>
        )
    }

    if (type.startsWith('video/')) {
        return (
            <div className='max-w-[260px]'>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={attachment.url} controls preload='metadata' className='rounded-lg max-h-52 w-full bg-black' />
                <div className='text-xs opacity-70 truncate mt-1'>{attachment.name}</div>
            </div>
        )
    }

    if (type.startsWith('audio/')) {
        return (
            <div className='max-w-[260px]'>
                <div className='text-xs opacity-80 truncate mb-1'>{attachment.name}</div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={attachment.url} controls preload='metadata' className='w-full h-10' />
            </div>
        )
    }

    if (type === 'application/pdf') {
        return (
            <a href={attachment.url} target='_blank' rel='noreferrer noopener' className='block max-w-[220px]'>
                <embed
                    src={attachment.url}
                    type='application/pdf'
                    className='rounded-lg w-full h-40 pointer-events-none bg-white border border-black/10'
                />
                <div className='flex items-center gap-2 mt-1'>
                    <FaFilePdf className='shrink-0' />
                    <span className='text-xs truncate'>{attachment.name}</span>
                </div>
            </a>
        )
    }

    const icon = type.startsWith('text/') ? <FaFileAlt className='shrink-0' /> : <FaFileDownload className='shrink-0' />;
    return <FileCard attachment={attachment} icon={icon} />;
}
