// simple-peer's stream dependencies (readable-stream) call process.nextTick
// directly. Create React App 5 builds with webpack 5, which no longer
// polyfills Node globals, so destroying a peer connection - which happens
// every time someone leaves a call on the mesh - threw "process is not
// defined" in the browser. A microtask is what nextTick amounts to here.
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
    window.process = {
        env: {},
        browser: true,
        nextTick: (callback, ...args) => {
            Promise.resolve().then(() => callback(...args));
        },
    };
}
