import { writable } from 'svelte/store';
import socket from './socket'

export const persistStore = (key, initial) =>{
  const {subscribe, set, update} = writable(initial)

  return {subscribe, set, update, useLocalStorage:() => {
    const persist = localStorage.getItem(key)
    if(persist) {
      const stored = JSON.parse(persist)
      if (stored && (stored.userID === 1224 || stored.userID === '1224' || stored.username === 'Yukiho')) {
        stored.userID = Math.random().toString(36).substring(2, 11);
        stored.username = 'Player_' + Math.floor(Math.random() * 900 + 100);
      }
      set(stored)
      socket.emit('use local storage', stored)
    }
    subscribe(value => {
      localStorage.setItem(key, JSON.stringify(value))
      if (typeof window !== 'undefined' && value) {
        socket.emit('use local storage', value)
      }
    })
  }}
}