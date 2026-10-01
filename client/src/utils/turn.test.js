jest.mock('./api', () => ({ getTURNCredentials: jest.fn() }));

describe('turn', () => {
    let turn;
    let api;

    beforeEach(() => {
        jest.resetModules();
        // eslint-disable-next-line global-require
        api = require('./api');
        // eslint-disable-next-line global-require
        turn = require('./turn');
    });

    it('has no relay servers until they are fetched', () => {
        expect(turn.getTurnIceServers()).toBeNull();
    });

    it('keeps what the server returns', async () => {
        const servers = [{ urls: 'turn:example' }];
        api.getTURNCredentials.mockResolvedValue(servers);

        expect(await turn.fetchTURNCredentials()).toEqual(servers);
        expect(turn.getTurnIceServers()).toEqual(servers);
    });

    it('carries on without them when the server cannot be reached', async () => {
        api.getTURNCredentials.mockRejectedValue(new Error('500'));
        jest.spyOn(console, 'log').mockImplementation(() => {});

        await expect(turn.fetchTURNCredentials()).resolves.toBeNull();

        expect(turn.getTurnIceServers()).toBeNull();
        console.log.mockRestore();
    });

    it('keeps earlier credentials if a later fetch fails', async () => {
        const servers = [{ urls: 'turn:example' }];
        api.getTURNCredentials.mockResolvedValueOnce(servers);
        await turn.fetchTURNCredentials();
        api.getTURNCredentials.mockRejectedValueOnce(new Error('down'));
        jest.spyOn(console, 'log').mockImplementation(() => {});

        expect(await turn.fetchTURNCredentials()).toEqual(servers);
        console.log.mockRestore();
    });

    it('ignores an empty response', async () => {
        api.getTURNCredentials.mockResolvedValue(undefined);

        expect(await turn.fetchTURNCredentials()).toBeNull();
    });
});
