import React from 'react'

const Input = ({placeholder,value, changeHandler}) => {
    return(
        <input className="outline-1 outline-gray-300 border-2 border-gray-200 py-2 rounded-sm px-5 text-lg text-gray-600 bg-blue-50" value={value} onChange={changeHandler} placeholder={placeholder}/>
    )
}

export const JoinRoomInputs = (props) => {
    const {roomIdValue, setRoomIdValue, nameValue, setNameValue, isRoomHost} = props;

    const handleRoomIdValueChange = (event) => {
        setRoomIdValue(event.target.value);
    }

    const handleNameValueChange = (event) => {
        setNameValue(event.target.value);
    }

  return (
    <div className='flex flex-col gap-3 w-full'>
        {!isRoomHost && <Input placeholder={'Enter the roomId'} value={roomIdValue} changeHandler={handleRoomIdValueChange}/>}
        <Input placeholder={'Enter you name'} value={nameValue} changeHandler={handleNameValueChange}/>
    </div>
  )
}
