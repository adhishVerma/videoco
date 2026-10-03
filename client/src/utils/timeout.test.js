import { withTimeout } from './timeout';

describe('withTimeout', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('resolves with the value when the promise settles in time', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 1000, () => new Error('late'))).resolves.toBe('ok');
    });

    it('passes through the promise\'s own rejection', async () => {
        await expect(withTimeout(Promise.reject(new Error('boom')), 1000, () => new Error('late'))).rejects.toThrow('boom');
    });

    it('rejects with the supplied error when the promise never settles', async () => {
        const pending = withTimeout(new Promise(() => {}), 1000, () => new Error('timed out'));
        const assertion = expect(pending).rejects.toThrow('timed out');

        jest.advanceTimersByTime(1000);

        await assertion;
    });

    it('does not reject early', async () => {
        const onError = jest.fn();
        withTimeout(new Promise(() => {}), 1000, () => new Error('timed out')).catch(onError);

        jest.advanceTimersByTime(999);
        await Promise.resolve();

        expect(onError).not.toHaveBeenCalled();
    });

    it('clears its timer once the promise settles', async () => {
        await withTimeout(Promise.resolve(1), 1000, () => new Error('late'));

        expect(jest.getTimerCount()).toBe(0);
    });
});
