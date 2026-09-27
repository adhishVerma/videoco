import React from 'react'
import { FaFileDownload, FaFilePdf, FaFileAlt } from "react-icons/fa";

const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileCard = ({ attachment, icon }) => (
    <a
        href={attachment.url}
        target='_blank'
        rel='noreferrer'
        className='flex items-center gap-2 bg-black/10 hover:bg-black/20 transition-colors rounded px-2 py-1.5 max-w-[220px]'
    >
        {icon}
        <span className='flex-1 min-w-0'>
            <span className='block truncate text-sm'>{attachment.name}</span>
            {attachment.size ? <span className='block text-xs opacity-70'>{formatSize(attachment.size)}</span> : null}
        </span>
    </a>
);

export const AttachmentPreview = ({ attachment }) => {
    if (!attachment || !attachment.url) return null;

    const type = attachment.type || '';

    if (type.startsWith('image/')) {
        return (
            <a href={attachment.url} target='_blank' rel='noreferrer' className='block max-w-[220px]'>
                <img src={attachment.url} alt={attachment.name} className='rounded max-h-52 w-auto' />
            </a>
        )
    }

    if (type.startsWith('video/')) {
        return (
            <div className='max-w-[260px]'>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={attachment.url} controls className='rounded max-h-52 w-full bg-black' />
                <div className='text-xs opacity-70 truncate mt-1'>{attachment.name}</div>
            </div>
        )
    }

    if (type.startsWith('audio/')) {
        return (
            <div className='max-w-[260px]'>
                <div className='text-xs opacity-80 truncate mb-1'>{attachment.name}</div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={attachment.url} controls className='w-full h-10' />
            </div>
        )
    }

    if (type === 'application/pdf') {
        return (
            <a href={attachment.url} target='_blank' rel='noreferrer' className='block max-w-[220px]'>
                <embed
                    src={attachment.url}
                    type='application/pdf'
                    className='rounded w-full h-40 pointer-events-none bg-white border border-black/10'
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
