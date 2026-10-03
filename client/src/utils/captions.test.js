import { isSpeechRecognitionSupported, startCaptioning, stopCaptioning } from './captions';

class FakeRecognition {
    constructor() {
        FakeRecognition.instance = this;
        this.start = jest.fn();
        this.stop = jest.fn();
    }
}

const result = (transcript, isFinal) => Object.assign([{ transcript }], { isFinal });

describe('captions', () => {
    beforeEach(() => {
        delete window.SpeechRecognition;
        delete window.webkitSpeechRecognition;
        FakeRecognition.instance = null;
    });

    afterEach(() => stopCaptioning());

    it('reports whether the browser can do speech recognition', () => {
        expect(isSpeechRecognitionSupported()).toBe(false);

        window.webkitSpeechRecognition = FakeRecognition;
        expect(isSpeechRecognitionSupported()).toBe(true);
    });

    it('does nothing where it is unsupported', () => {
        expect(startCaptioning(jest.fn())).toBeNull();
    });

    it('starts a continuous recognizer that reports interim results', () => {
        window.SpeechRecognition = FakeRecognition;

        startCaptioning(jest.fn());

        const r = FakeRecognition.instance;
        expect(r.start).toHaveBeenCalled();
        expect(r.continuous).toBe(true);
        expect(r.interimResults).toBe(true);
    });

    it('separates finished sentences from the one still being spoken', () => {
        window.SpeechRecognition = FakeRecognition;
        const onResult = jest.fn();
        startCaptioning(onResult);

        FakeRecognition.instance.onresult({
            resultIndex: 0,
            results: [result(' hello there ', true), result(' how are', false)],
        });

        expect(onResult).toHaveBeenCalledWith({ finalTranscript: 'hello there', interimTranscript: 'how are' });
    });

    it('only reads results from the index that changed', () => {
        window.SpeechRecognition = FakeRecognition;
        const onResult = jest.fn();
        startCaptioning(onResult);

        FakeRecognition.instance.onresult({ resultIndex: 1, results: [result('old', true), result('new', true)] });

        expect(onResult).toHaveBeenCalledWith({ finalTranscript: 'new', interimTranscript: '' });
    });

    it('keeps listening after the browser stops it for silence', () => {
        window.SpeechRecognition = FakeRecognition;
        startCaptioning(jest.fn());
        const r = FakeRecognition.instance;
        r.start.mockClear();

        r.onend();

        expect(r.start).toHaveBeenCalledTimes(1);
    });

    it('survives a failed restart', () => {
        window.SpeechRecognition = FakeRecognition;
        startCaptioning(jest.fn());
        const r = FakeRecognition.instance;
        r.start.mockImplementation(() => { throw new Error('already started'); });

        expect(() => r.onend()).not.toThrow();
    });

    it('logs a recognition error without throwing', () => {
        window.SpeechRecognition = FakeRecognition;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        startCaptioning(jest.fn());

        expect(() => FakeRecognition.instance.onerror({ error: 'no-speech' })).not.toThrow();
        console.log.mockRestore();
    });

    it('stops for good, without restarting itself', () => {
        window.SpeechRecognition = FakeRecognition;
        startCaptioning(jest.fn());
        const r = FakeRecognition.instance;

        stopCaptioning();

        expect(r.stop).toHaveBeenCalled();
        expect(r.onend).toBeNull();
    });

    it('is safe to stop when nothing is running', () => {
        expect(() => stopCaptioning()).not.toThrow();
    });
});
