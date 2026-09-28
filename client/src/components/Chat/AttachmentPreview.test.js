import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AttachmentPreview } from './AttachmentPreview';

describe('AttachmentPreview', () => {
    it('renders nothing when there is no attachment', () => {
        const { container } = render(<AttachmentPreview attachment={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when the attachment has no url', () => {
        const { container } = render(<AttachmentPreview attachment={{ type: 'image/png' }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders an <img> for image attachments', () => {
        render(<AttachmentPreview attachment={{ url: 'https://cdn.example.com/a.png', type: 'image/png', name: 'a.png' }} />);
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://cdn.example.com/a.png');
    });

    it('renders a <video> element with controls for video attachments', () => {
        const { container } = render(<AttachmentPreview attachment={{ url: 'https://cdn.example.com/a.mp4', type: 'video/mp4', name: 'a.mp4' }} />);
        const video = container.querySelector('video');
        expect(video).toHaveAttribute('src', 'https://cdn.example.com/a.mp4');
        expect(video).toHaveAttribute('controls');
        expect(screen.getByText('a.mp4')).toBeInTheDocument();
    });

    it('renders an <audio> element with controls for audio attachments', () => {
        const { container } = render(<AttachmentPreview attachment={{ url: 'https://cdn.example.com/a.mp3', type: 'audio/mpeg', name: 'a.mp3' }} />);
        const audio = container.querySelector('audio');
        expect(audio).toHaveAttribute('src', 'https://cdn.example.com/a.mp3');
        expect(audio).toHaveAttribute('controls');
    });

    it('renders an embedded preview for PDF attachments', () => {
        const { container } = render(<AttachmentPreview attachment={{ url: 'https://cdn.example.com/a.pdf', type: 'application/pdf', name: 'a.pdf' }} />);
        const embed = container.querySelector('embed');
        expect(embed).toHaveAttribute('src', 'https://cdn.example.com/a.pdf');
        expect(embed).toHaveAttribute('type', 'application/pdf');
    });

    it('falls back to a download card for other file types', () => {
        render(<AttachmentPreview attachment={{ url: 'https://cdn.example.com/a.zip', type: 'application/zip', name: 'a.zip', size: 2048 }} />);
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', 'https://cdn.example.com/a.zip');
        expect(screen.getByText('a.zip')).toBeInTheDocument();
        expect(screen.getByText('2 KB')).toBeInTheDocument();
    });
});
