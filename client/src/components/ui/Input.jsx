import React, { useId } from 'react'

// A real labelled field: the label is what screen readers (and anyone whose
// placeholder has disappeared mid-typing) rely on, and `error` explains what
// to fix instead of just refusing to continue.
const Input = ({ label, placeholder, value, changeHandler, type = 'text', error, hint, ...rest }) => {
    const id = useId();
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>}
            <input
                id={id}
                type={type}
                value={value}
                onChange={changeHandler}
                placeholder={placeholder}
                aria-invalid={!!error}
                aria-describedby={error || hint ? `${id}-note` : undefined}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'}`}
                {...rest}
            />
            {(error || hint) && (
                <p id={`${id}-note`} className={`text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>{error || hint}</p>
            )}
        </div>
    )
}

export default Input
