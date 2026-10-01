const { createIdleWatcher } = require('./idle');

describe('createIdleWatcher', () => {
  let counts;
  let onWarn;
  let onTimeout;

  const make = (overrides = {}) => createIdleWatcher({
    aloneTimeoutMs: 10 * 60 * 1000,
    warnBeforeMs: 60 * 1000,
    getUserCount: (roomId) => counts[roomId] || 0,
    onWarn,
    onTimeout,
    ...overrides,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    counts = {};
    onWarn = jest.fn();
    onTimeout = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('warns, then ends a room that stays at one participant', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');

    jest.advanceTimersByTime(9 * 60 * 1000 - 1);
    expect(onWarn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onWarn).toHaveBeenCalledWith('r1', 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60 * 1000);
    expect(onTimeout).toHaveBeenCalledWith('r1');
  });

  it('does not start a countdown for a room with more than one participant', () => {
    const idle = make();
    counts.r1 = 2;
    idle.refresh('r1');

    jest.advanceTimersByTime(60 * 60 * 1000);

    expect(onWarn).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
    expect(idle.isPending('r1')).toBe(false);
  });

  it('cancels the countdown when a second person joins', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');
    jest.advanceTimersByTime(5 * 60 * 1000);

    counts.r1 = 2;
    idle.refresh('r1');
    jest.advanceTimersByTime(60 * 60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('restarts from the full duration when someone leaves and it is one-person again', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');
    jest.advanceTimersByTime(8 * 60 * 1000);

    counts.r1 = 2;
    idle.refresh('r1');
    counts.r1 = 1;
    idle.refresh('r1');

    jest.advanceTimersByTime(8 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2 * 60 * 1000);
    expect(onTimeout).toHaveBeenCalledWith('r1');
  });

  it('does not stack a second countdown on repeated refreshes', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');
    idle.refresh('r1');
    idle.refresh('r1');

    jest.advanceTimersByTime(10 * 60 * 1000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onWarn).toHaveBeenCalledTimes(1);
  });

  it('extend() restarts the full countdown', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');
    jest.advanceTimersByTime(9 * 60 * 1000 + 30 * 1000);
    expect(onWarn).toHaveBeenCalledTimes(1);

    idle.extend('r1');
    jest.advanceTimersByTime(9 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60 * 1000);
    expect(onTimeout).toHaveBeenCalledWith('r1');
  });

  it('re-checks the head count when the timer fires instead of trusting stale state', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');

    counts.r1 = 0; // everyone left but nobody called refresh
    jest.advanceTimersByTime(10 * 60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('clear() cancels a pending countdown', () => {
    const idle = make();
    counts.r1 = 1;
    idle.refresh('r1');
    idle.clear('r1');

    jest.advanceTimersByTime(60 * 60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('tracks rooms independently', () => {
    const idle = make();
    counts.a = 1;
    counts.b = 1;
    idle.refresh('a');
    jest.advanceTimersByTime(5 * 60 * 1000);
    idle.refresh('b');

    jest.advanceTimersByTime(5 * 60 * 1000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledWith('a');
  });

  it('is fully disabled when the timeout is 0', () => {
    const idle = make({ aloneTimeoutMs: 0 });
    counts.r1 = 1;
    idle.refresh('r1');

    jest.advanceTimersByTime(24 * 60 * 60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(idle.isPending('r1')).toBe(false);
  });

  it('warns immediately when the whole timeout is shorter than the warning window', () => {
    const idle = make({ aloneTimeoutMs: 30 * 1000, warnBeforeMs: 60 * 1000 });
    counts.r1 = 1;
    idle.refresh('r1');

    jest.advanceTimersByTime(0);
    expect(onWarn).toHaveBeenCalledWith('r1', 30 * 1000);
  });

  it('stopAll() cancels everything', () => {
    const idle = make();
    counts.a = 1;
    counts.b = 1;
    idle.refresh('a');
    idle.refresh('b');
    idle.stopAll();

    jest.advanceTimersByTime(60 * 60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
