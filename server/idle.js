// Ends rooms that have only one person left in them.
//
// Why this exists: every connected participant keeps a LiveKit connection
// publishing audio/video, and that's what gets billed. A host who walks away
// from an open tab, or whose guests all dropped, would otherwise keep paying
// for an empty call indefinitely. The room itself already closes when its LAST
// socket disconnects; this covers the "one person still connected, nobody
// else coming" case that never reaches zero.
//
// Pure scheduling logic - the actual warn/end side effects are injected so
// this stays testable with fake timers and no sockets.

const createIdleWatcher = ({
  aloneTimeoutMs,
  warnBeforeMs,
  getUserCount,
  onWarn,
  onTimeout,
  timers = { setTimeout, clearTimeout },
}) => {
  const enabled = aloneTimeoutMs > 0;
  const pending = new Map(); // roomId -> { warnTimer, endTimer }

  const clear = (roomId) => {
    const entry = pending.get(roomId);
    if (!entry) return;
    timers.clearTimeout(entry.warnTimer);
    timers.clearTimeout(entry.endTimer);
    pending.delete(roomId);
  };

  const unref = (timer) => {
    // never let a pending idle timer keep the process alive on shutdown
    if (timer && typeof timer.unref === 'function') timer.unref();
    return timer;
  };

  const start = (roomId) => {
    const warnDelay = Math.max(0, aloneTimeoutMs - warnBeforeMs);
    const effectiveWarn = aloneTimeoutMs - warnDelay;

    const warnTimer = unref(timers.setTimeout(() => {
      if (getUserCount(roomId) === 1) onWarn(roomId, effectiveWarn);
    }, warnDelay));

    const endTimer = unref(timers.setTimeout(() => {
      pending.delete(roomId);
      // re-check at fire time - someone may have joined and left again
      if (getUserCount(roomId) === 1) onTimeout(roomId);
    }, aloneTimeoutMs));

    pending.set(roomId, { warnTimer, endTimer });
  };

  // Call after ANY membership change. Starts the countdown the moment a room
  // drops to exactly one person, and cancels it the moment that's no longer true.
  const refresh = (roomId) => {
    if (!enabled) return;
    const count = getUserCount(roomId);
    if (count === 1) {
      if (!pending.has(roomId)) start(roomId);
    } else {
      clear(roomId);
    }
  };

  // The lone participant chose to keep the room open: restart the full countdown.
  const extend = (roomId) => {
    if (!enabled) return;
    clear(roomId);
    if (getUserCount(roomId) === 1) start(roomId);
  };

  const stopAll = () => {
    for (const roomId of [...pending.keys()]) clear(roomId);
  };

  return { refresh, extend, clear, stopAll, isPending: (roomId) => pending.has(roomId) };
};

module.exports = { createIdleWatcher };
