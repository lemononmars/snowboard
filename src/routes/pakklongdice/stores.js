import { writable } from 'svelte/store';

export const chosenTheme = writable('snow');
export const stateIndex = writable(0)
export const difficulty = writable(2)
export const gameLength = writable(3)
export const shuffle = writable(0)
export const myUsername = writable('Me')