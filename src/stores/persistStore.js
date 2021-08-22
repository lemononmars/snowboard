import { writable } from 'svelte/store';
import socket from './socket'

export const persistStore = (key, initial) =>{
  const {subscribe, set, update} = writable(initial)

  return {subscribe, set, update, useLocalStorage:() => {
    const persist = localStorage.getItem(key)
    if(persist) {
      const stored = JSON.parse(persist)
      set(stored)
      socket.emit('use local storage', stored)
    }
    subscribe(value => {
      localStorage.setItem(key, JSON.stringify(value))
    })
  }}
}