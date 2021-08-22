import { persistStore } from './persistStore'
import socket from './socket'

const defaultInfo = {
  userID: 1224,
  username: 'Yukiho',
  roomID: 'lobby'
}

export const selfInfo = persistStore('selfInfo', defaultInfo)

socket.on('initialize user', newSelf => {
  selfInfo.set(newSelf)
})