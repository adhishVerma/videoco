// Rejects with `makeError()` if `promise` hasn't settled within `ms`.
// Only the wait is abandoned - the underlying operation isn't cancelled, so
// callers clean up whatever it might still produce (see callSession.js).
export const withTimeout = (promise, ms, makeError) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(makeError()), ms);
    promise.then(
        (value) => {
            clearTimeout(timer);
            resolve(value);
        },
        (err) => {
            clearTimeout(timer);
            reject(err);
        },
    );
});
