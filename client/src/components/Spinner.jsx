import React from 'react'

const Spinner = () => {
    return (
        <div className="h-full w-full z-10 flex justify-center items-center">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-white"></div>
        </div>
    )
}

export default Spinner

