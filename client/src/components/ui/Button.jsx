import React from 'react'

const VARIANTS = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    // round control-bar button; `active` marks a "something is off" state
    // (muted mic, camera off) in red so the state reads at a glance
    icon: 'rounded-full !p-0 w-10 h-10 sm:w-11 sm:h-11 !min-w-0 text-lg sm:text-xl flex items-center justify-center bg-room-raised text-white hover:bg-room-border',
    'icon-light': 'rounded-full !p-0 w-10 h-10 !min-w-0 text-lg flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
};

const Button = ({ variant = 'primary', active = false, className = '', title, children, type = 'button', ...rest }) => {
    const style = VARIANTS[variant] || VARIANTS.primary;
    const activeStyle = active ? '!bg-red-600 !text-white hover:!bg-red-700' : '';
    return (
        <button
            type={type}
            title={title}
            aria-label={rest['aria-label'] || title}
            className={`${style} ${activeStyle} inline-flex items-center justify-center gap-2 font-medium text-sm rounded-lg py-2.5 px-5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...rest}
        >
            {children}
        </button>
    )
}

export default Button
