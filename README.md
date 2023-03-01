# Videoco
A Browser based application that can transmit video data between 2 browsers. Use it to video call others, by just using your email id.

<!-- **Link to project:** http://recruiters-love-seeing-live-demos.com/ -->

<!-- ![alt tag](http://placecorgi.com/1200/650) -->

## How It's Made:

**Tech used:** React JS, Express, Socket.io, WebRTC

The objective was to learn how to build a video calling application. The structure of a video calling application consists of a central server that manages the connection and is resposible or transfer of video data. 

Diving deeper I found out about webRTC, a very simple protocol for transfer of mediaStreams via the p2p network. The connections are established and handled by the client or browsers, nullifying the need of a central server for transfer of video data.

We still need some sort of medium to establish peer connections(i.e. credentials in layman terms), that's where we use a simple Express server that uses socket.io according to our need.

Once the peer connection is established between the 2 browsers, the streaming starts, we just need to display them correctly.


<!-- ## Optimizations
*(optional)*

You don't have to include this section but interviewers *love* that you can not only deliver a final product that looks great but also functions efficiently. Did you write something then refactor it later and the result was 5x faster than the original implementation? Did you cache your assets? Things that you write in this section are **GREAT** to bring up in interviews and you can use this section as reference when studying for technical interviews! -->

## Lessons Learned:

webRTC is a simple protocol to exchange data, between the browsers. As the browsers are on every device and there's native interface available for accessing the media devices it can be widely used.We don't need to worry about how to access these devices, if there is proper browser support we can use this on every device.
It can be used for audio streams, video streams, and screen sharing.  

For multiple devices to connect in a single call it's complex, but it's achievable.






