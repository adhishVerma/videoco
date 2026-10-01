import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectionStatus from './ConnectionStatus';

describe('ConnectionStatus', () => {
    it('shows nothing once connected', () => {
        const { container } = render(<ConnectionStatus status="connected" />);

        expect(container).toBeEmptyDOMElement();
    });

    it.each([
        ['starting', /starting call/i],
        ['media', /camera and microphone/i],
        ['joining', /joining room/i],
        ['connecting', /connecting/i],
    ])('shows progress as a small status while "%s"', (status, text) => {
        render(<ConnectionStatus status={status} />);

        expect(screen.getByRole('status')).toHaveTextContent(text);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('says the connection dropped while reconnecting', () => {
        render(<ConnectionStatus status="reconnecting" />);

        expect(screen.getByRole('status')).toHaveTextContent(/reconnecting/i);
    });

    it('explains a camera/microphone failure and offers retry and leave', () => {
        const onRetry = jest.fn();
        const onLeave = jest.fn();
        render(<ConnectionStatus status="failed" kind="media" onRetry={onRetry} onLeave={onLeave} />);

        expect(screen.getByRole('alertdialog')).toHaveTextContent(/camera or microphone/i);
        fireEvent.click(screen.getByText('Try again'));
        fireEvent.click(screen.getByText('Leave'));

        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it('explains a connection failure differently from a camera failure', () => {
        render(<ConnectionStatus status="failed" kind="connection" onRetry={jest.fn()} onLeave={jest.fn()} />);

        expect(screen.getByRole('alertdialog')).toHaveTextContent(/connect to the call/i);
        expect(screen.getByRole('alertdialog')).not.toHaveTextContent(/camera or microphone/i);
    });

    it('treats an unknown failure kind as a connection problem rather than crashing', () => {
        render(<ConnectionStatus status="failed" kind="mystery" onRetry={jest.fn()} onLeave={jest.fn()} />);

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
});
