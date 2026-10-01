describe('polyfills', () => {
    const original = window.process;

    afterEach(() => {
        window.process = original;
        jest.resetModules();
    });

    const load = () => {
        // eslint-disable-next-line global-require
        require('./polyfills');
        return window.process;
    };

    it('provides process.nextTick where the browser has no process', async () => {
        delete window.process;

        const polyfilled = load();
        const calls = [];
        polyfilled.nextTick((a, b) => calls.push([a, b]), 1, 2);

        expect(calls).toEqual([]); // deferred, never synchronous
        await Promise.resolve();
        expect(calls).toEqual([[1, 2]]);
    });

    it('marks itself as a browser environment with an env object', () => {
        delete window.process;

        const polyfilled = load();

        expect(polyfilled.browser).toBe(true);
        expect(polyfilled.env).toEqual({});
    });

    it('leaves a real process alone', () => {
        const real = { env: { REAL: '1' }, nextTick: jest.fn() };
        window.process = real;

        expect(load()).toBe(real);
    });
});
