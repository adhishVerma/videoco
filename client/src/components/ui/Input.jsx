import React from 'react'

const Input = ({ placeholder, value, changeHandler }) => {
    return (
        <input className="border-b-2 opacity-95 active:opacity-100 p-2 border-transparent placeholder:text-gray-600 outline-none focus:border-blue-600 rounded-t rounded-b-sm text-gray-800 bg-skin-secondary" value={value} onChange={changeHandler} placeholder={placeholder} />
    )
}

export default Input