import React from 'react'

// `decorative` for a spinner that sits beside text already describing what is
// happening - otherwise a screen reader announces it twice.
const Spinner = ({ className = 'h-10 w-10', decorative = false }) => (
    <div
        {...(decorative ? { 'aria-hidden': true } : { role: 'status', 'aria-label': 'Loading' })}
        className={`animate-spin rounded-full border-2 border-white/25 border-t-white ${className}`}
    />
)

export default Spinner
