import React from "react";

const Connect = () => {
  return (
    <div className="flex flex-col gap-10 h-screen items-center justify-center">
      <div className="text-3xl">Call User</div>
      <div className="flex flex-col gap-10">
        <input type="email" placeholder="email" className="outline-none border-0 py-3 rounded-md px-5 text-lg text-gray-600"/>
        <button className="bg-white hover:bg-gray-300 active:bg-gray-400 text-black rounded-2xl px-8 py-2 w-1/2 self-center">Invite</button>
      </div>
    </div>
  );
};

export default Connect;
