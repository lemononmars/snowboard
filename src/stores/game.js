import { loadingWritable } from './utils'
import { writable } from 'svelte/store';
//import socket from './socket'

export const gameInfo = loadingWritable({})
export const gameConfigs = loadingWritable({})
export const stateIndex = writable(0)

