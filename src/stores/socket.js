import io from 'socket.io-client';

const socket = io({ 
  rejectUnauthorized: false,
  transports: ['websocket', 'polling']
})

socket.on('connect', () => {
  console.log('CONNECTED')
})

socket.on("connect_error", (err) => {
  // console.log(err)
  console.log(`connect_error due to ${err.message}`);
});

export default socket;