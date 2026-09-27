import React from 'react'
import { FaFileDownload } from "react-icons/fa";

const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AttachmentPreview = ({ attachment }) => {
    if (!attachment || !attachment.url) return null;

    const isImage = attachment.type && attachment.type.startsWith('image/');

    if (isImage) {
        return (
            <a href={attachment.url} target='_blank' rel='noreferrer' className='block max-w-[220px]'>
                <img src={attachment.url} alt={attachment.name} className='rounded max-h-52 w-auto' />
            </a>
        )
    }

    return (
        <a
            href={attachment.url}
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-2 bg-black/10 hover:bg-black/20 transition-colors rounded px-2 py-1.5 max-w-[220px]'
        >
            <FaFileDownload className='shrink-0' />
            <span className='flex-1 min-w-0'>
                <span className='block truncate text-sm'>{attachment.name}</span>
                {attachment.size ? <span className='block text-xs opacity-70'>{formatSize(attachment.size)}</span> : null}
            </span>
        </a>
    )
}
