import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import reducer from './store/reducer';

export const makeStore = (state = {}) => configureStore({
    reducer,
    preloadedState: {
        identity: '',
        isRoomHost: false,
        connectOnlyAudio: false,
        roomId: null,
        roomPassword: '',
        participants: [],
        ...state,
    },
});

// renders `ui` inside a real redux store and a router, returning both so a
// test can assert on what ended up in the store
export const renderWithStore = (ui, { state, route = '/' } = {}) => {
    const store = makeStore(state);
    const wrap = (children) => (
        <Provider store={store}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </Provider>
    );
    const utils = render(wrap(ui));
    // plain rerender() would drop the providers
    return { store, ...utils, rerenderWithStore: (nextUi) => utils.rerender(wrap(nextUi)) };
};

export const makeVideoTrack = (overrides = {}) => ({
    kind: 'video',
    readyState: 'live',
    enabled: true,
    muted: false,
    stop: jest.fn(),
    ...overrides,
});

export const makeAudioTrack = (overrides = {}) => ({
    kind: 'audio',
    readyState: 'live',
    enabled: true,
    muted: false,
    stop: jest.fn(),
    ...overrides,
});
