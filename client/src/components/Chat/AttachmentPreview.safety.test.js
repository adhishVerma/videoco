import React from 'react';
import { render } from '@testing-library/react';
import { AttachmentPreview, isSafeUrl } from './AttachmentPreview';

describe('AttachmentPreview URL safety', () => {
    it.each([
        ['https://cdn.example.com/a.png', true],
        ['http://localhost:9000/a.png', true],
        ['javascript:alert(1)', false],
        ['JaVaScRiPt:alert(1)', false],
        ['data:text/html,<script>alert(1)</script>', false],
        ['vbscript:msgbox(1)', false],
        ['file:///etc/passwd', false],
        ['//evil.example.com/a.png', false],
        ['', false],
        ['not a url', false],
    ])('isSafeUrl(%s) is %s', (url, expected) => {
        expect(isSafeUrl(url)).toBe(expected);
    });

    it.each(['image/png', 'video/mp4', 'audio/mpeg', 'application/pdf', 'application/zip'])('renders nothing for an unsafe %s URL', (type) => {
        const { container } = render(<AttachmentPreview attachment={{ url: 'javascript:alert(1)', type, name: 'x' }} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('opens links safely', () => {
        const { container } = render(<AttachmentPreview attachment={{ url: 'https://cdn.example.com/a.zip', type: 'application/zip', name: 'a.zip' }} />);

        expect(container.querySelector('a')).toHaveAttribute('rel', 'noreferrer noopener');
    });
});
