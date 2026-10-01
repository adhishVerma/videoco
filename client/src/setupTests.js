// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom (CRA's default jest test environment) doesn't implement WebRTC APIs
// like MediaStream - the LiveKit handler and stream components construct
// real MediaStream objects, so tests need a minimal stand-in.
if (typeof global.MediaStream === 'undefined') {
    class FakeMediaStream {
        constructor(tracks = []) {
            this._tracks = [...tracks];
        }

        getTracks() {
            return [...this._tracks];
        }

        getVideoTracks() {
            return this._tracks.filter((t) => t.kind === 'video');
        }

        getAudioTracks() {
            return this._tracks.filter((t) => t.kind === 'audio');
        }

        addTrack(track) {
            this._tracks.push(track);
        }

        removeTrack(track) {
            this._tracks = this._tracks.filter((t) => t !== track);
        }
    }

    global.MediaStream = FakeMediaStream;
}
