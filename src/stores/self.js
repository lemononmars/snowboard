import { writable } from 'svelte/store';
import socket from './socket'

export const selfInfo = writable({
  userID: 1224,
  username: 'Yukiho',
  roomID: 'lobby'
})

socket.on('self_info', newSelf => {
  selfInfo.set(newSelf)
})