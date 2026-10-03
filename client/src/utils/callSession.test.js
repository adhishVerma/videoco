import { beginSession, endSession, isCurrentSession, ensureCurrent, SessionCancelled } from './callSession';

describe('callSession', () => {
    it('treats the latest session as current', () => {
        const id = beginSession();

        expect(isCurrentSession(id)).toBe(true);
        expect(() => ensureCurrent(id)).not.toThrow();
    });

    it('cancels the previous session when a new one begins (a retry)', () => {
        const first = beginSession();
        const second = beginSession();

        expect(isCurrentSession(first)).toBe(false);
        expect(isCurrentSession(second)).toBe(true);
        expect(() => ensureCurrent(first)).toThrow(SessionCancelled);
    });

    it('cancels the current session when the call is left', () => {
        const id = beginSession();

        endSession();

        expect(isCurrentSession(id)).toBe(false);
        expect(() => ensureCurrent(id)).toThrow(SessionCancelled);
    });

    it('never treats an undefined id as current', () => {
        beginSession();

        expect(isCurrentSession(undefined)).toBe(false);
    });
});
