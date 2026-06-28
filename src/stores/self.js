import { persistStore } from './persistStore'
import socket from './socket'
import nameGen from '../game/name.js'

const defaultInfo = {
  userID: Math.random().toString(36).substring(2, 11),
  username: typeof window !== 'undefined' ? nameGen() : 'Player',
  roomID: 'lobby',
  isDarkMode: false
}

export const selfInfo = persistStore('selfInfo', defaultInfo)

socket.on('initialize user', newSelf => {
  selfInfo.update(current => ({
    ...current,
    ...newSelf
  }))
})