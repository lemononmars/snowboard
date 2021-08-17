import io from 'socket.io-client';

const socket = io();
socket.on('connect', () => {
  console.log('CONNECTED')
})

// do this once you connect
socket.on('initialize user', (data)=>{
  if(socket.id === data.userID)
    socket.data = data
})

export default socket;