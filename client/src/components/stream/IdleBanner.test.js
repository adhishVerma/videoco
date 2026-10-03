import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import IdleBanner from './IdleBanner';

describe('IdleBanner', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('tells the lone participant how long the room has left', () => {
        render(<IdleBanner secondsLeft={60} onKeepOpen={jest.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent('1:00');
    });

    it('counts down every second', () => {
        render(<IdleBanner secondsLeft={60} onKeepOpen={jest.fn()} />);

        act(() => { jest.advanceTimersByTime(15000); });

        expect(screen.getByRole('alert')).toHaveTextContent('0:45');
    });

    it('never goes below zero', () => {
        render(<IdleBanner secondsLeft={2} onKeepOpen={jest.fn()} />);

        act(() => { jest.advanceTimersByTime(10000); });

        expect(screen.getByRole('alert')).toHaveTextContent('0:00');
    });

    it('pads seconds', () => {
        render(<IdleBanner secondsLeft={65} onKeepOpen={jest.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent('1:05');
    });

    it('lets them keep the room open', () => {
        const onKeepOpen = jest.fn();
        render(<IdleBanner secondsLeft={30} onKeepOpen={onKeepOpen} />);

        fireEvent.click(screen.getByText('Keep room open'));

        expect(onKeepOpen).toHaveBeenCalledTimes(1);
    });

    it('restarts the countdown from a new warning', () => {
        const { rerender } = render(<IdleBanner secondsLeft={30} onKeepOpen={jest.fn()} />);
        act(() => { jest.advanceTimersByTime(10000); });

        rerender(<IdleBanner secondsLeft={60} onKeepOpen={jest.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent('1:00');
    });

    it('stops its timer when it goes away', () => {
        const { unmount } = render(<IdleBanner secondsLeft={30} onKeepOpen={jest.fn()} />);

        unmount();

        expect(jest.getTimerCount()).toBe(0);
    });
});
