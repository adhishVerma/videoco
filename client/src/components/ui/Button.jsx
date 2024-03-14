import React from 'react'

const Button = (props) => {
    let style;
    switch (props.variant) {
        case 'primary':
            style = 'bg-skin-btn-primary text-skin-btn-primary'
            break;
        case 'secondary':
            style = 'bg-skin-btn-secondary text-skin-btn-secondary'
            break;
        case 'danger':
            style = 'bg-red-500 text-skin-btn-primary'
            break;
        case 'icon':
            style = 'bg-skin-btn-secondary text-skin-btn-secondary !max-w-fit !min-w-0 text-xl !py-2'
            break;
        default:
            style = 'bg-skin-btn-primary text-skin-btn-primary'
            break;
    }
    return (
        <button onClick={props.onClick} className={`${style} outline-none text-clip font-medium text-base rounded py-1.5 px-3 self-center min-w-24 max-w-content shadow active:shadow-sm opacity-90 hover:opacity-100`}>{props.children}</button>
    )
}

export default Button