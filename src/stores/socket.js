import { supabase } from '../supabase.js';
import nameGen from '../game/name.js';
import RoomCreator from '../game/Room.js';

// Initialize local host logic
const mockIo = {
  to: (roomID) => ({
    emit: (event, data) => {
      // Broadcast to specific room channel
      if (socket.channels[roomID]) {
        socket.channels[roomID].send({
          type: 'broadcast',
          event: event,
          payload: { event, data }
        });
      }
      // Also trigger locally for the host
      socket.handleLocalEvent(event, data);
    }
  }),
  emit: (event, data) => {
    socket.lobbyChannel.send({
      type: 'broadcast',
      event: event,
      payload: { event, data }
    });
    socket.handleLocalEvent(event, data);
  }
};

const { RoomList } = RoomCreator(mockIo);
const localRooms = new RoomList();

class RealtimeSocket {
  constructor() {
    this.channels = {};
    this.listeners = {};
    this.callbacks = {};
    this.msgId = 0;
    this.data = {
      userID: Math.random().toString(36).substr(2, 9),
      username: nameGen(),
      roomID: 'lobby'
    };

    // Setup lobby channel
    this.lobbyChannel = supabase.channel('lobby', { config: { broadcast: { ack: true } } });
    this.lobbyChannel.on('broadcast', { event: '*' }, (payload) => this.handleMessage(payload.payload));
    this.lobbyChannel.subscribe();

    // Setup personal channel for direct messages (callbacks)
    this.personalChannel = supabase.channel(`user_${this.data.userID}`, { config: { broadcast: { ack: true } } });
    this.personalChannel.on('broadcast', { event: '*' }, (payload) => this.handleMessage(payload.payload));
    this.personalChannel.subscribe();

    // Delay initialization to allow app to mount
    setTimeout(() => {
      this.handleLocalEvent('initialize user', this.data);
    }, 500);
  }

  handleMessage(payload) {
    const { event, data, callbackId, senderId } = payload;
    
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }

    if (event.startsWith('callback_')) {
      const id = event.split('_')[1];
      if (this.callbacks[id]) {
        this.callbacks[id](data);
        delete this.callbacks[id];
      }
    }
    
    // Host Logic Handlers
    this.handleHostEvents(payload);
  }

  handleHostEvents(payload) {
    const { event, data, callbackId, senderId } = payload;
    
    const reply = (res) => {
      if (callbackId && senderId) {
        const chan = supabase.channel(`user_${senderId}`);
        chan.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            chan.send({ type: 'broadcast', event: `callback_${callbackId}`, payload: { data: res } });
            chan.unsubscribe();
          }
        });
      }
    };

    // If I am hosting rooms, I answer these queries
    if (event === 'req_get_rooms') {
      const myRooms = localRooms.filterByTitle(data); // data is gameTitle
      if (myRooms.length > 0) {
         reply(myRooms);
      }
    }

    if (event === 'try joining room') {
      const rm = localRooms.attemptToJoin(data); // data is roomID
      if (rm) reply(rm);
    }
  }

  handleLocalEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data, callback) {
    let callbackId = null;
    if (typeof data === 'function') {
      callback = data;
      data = null;
    }
    if (callback) {
      callbackId = ++this.msgId;
      this.callbacks[callbackId] = callback;
    }

    const payload = { event, data, callbackId, senderId: this.data.userID };

    // Intercept commands that should be handled by the HOST or global
    if (event === 'create room') {
      const newRoomID = localRooms.newRoom(data.gameTitle);
      // I am the host, I must join the room channel to listen to players
      this.joinRoomChannel(newRoomID);
      if (callback) callback(newRoomID);
      return;
    }

    if (event === 'get rooms') {
      // Instead of waiting for a single server, wait for any host to reply
      // For a prototype, just returning empty if no one replies in 1s is okay.
      this.lobbyChannel.send({ type: 'broadcast', event: 'req_get_rooms', payload });
      if (callback) {
        setTimeout(() => {
           if (this.callbacks[callbackId]) {
             this.callbacks[callbackId]([]); // default empty
             delete this.callbacks[callbackId];
           }
        }, 1000);
      }
      return;
    }

    if (event === 'join room' || event === 'try joining room' || event === 'submit action' || event === 'start game') {
      const roomID = this.data.roomID !== 'lobby' ? this.data.roomID : data;
      if (this.channels[roomID]) {
        this.channels[roomID].send({ type: 'broadcast', event: event, payload });
      } else {
        // Broadcast to lobby if we haven't joined a room yet (e.g. try joining room)
        this.lobbyChannel.send({ type: 'broadcast', event: event, payload });
      }
      
      // If I am the host, handle it locally too
      this.hostHandleClientEvent(event, data, payload);
      return;
    }

    // Default broadcast
    if (this.data.roomID !== 'lobby' && this.channels[this.data.roomID]) {
      this.channels[this.data.roomID].send({ type: 'broadcast', event: event, payload });
    } else {
      this.lobbyChannel.send({ type: 'broadcast', event: event, payload });
    }
  }

  joinRoomChannel(roomID) {
    if (this.channels[roomID]) return;
    this.data.roomID = roomID;
    const channel = supabase.channel(`room_${roomID}`, { config: { broadcast: { ack: true } } });
    channel.on('broadcast', { event: '*' }, (payload) => {
      this.handleMessage(payload.payload);
      // Process if I am the host
      this.hostHandleClientEvent(payload.payload.event, payload.payload.data, payload.payload);
    });
    channel.subscribe();
    this.channels[roomID] = channel;
  }

  hostHandleClientEvent(event, data, payload) {
    const { callbackId, senderId } = payload;
    const room = localRooms.findRoomById(this.data.roomID);
    if (!room) return; // I am not the host of this room

    // Create a mock socket for the client to pass to Room/Game logic
    const clientSocket = {
      data: { userID: senderId, username: data && data.username ? data.username : 'Player' },
      join: () => {},
      leave: () => {},
      on: () => {}, // Handled differently
      emit: (e, d) => {
        // Send back to client
        const chan = supabase.channel(`user_${senderId}`);
        chan.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            chan.send({ type: 'broadcast', event: e, payload: { data: d } });
            chan.unsubscribe();
          }
        });
      }
    };

    if (event === 'join room') {
       room.addPlayer(clientSocket);
       if (this.callbacks[callbackId]) {
         this.callbacks[callbackId]({successful: true});
       }
    }
    if (event === 'start game') {
       room.attemptToStart(data);
    }
    if (event === 'submit action') {
       if (room.game) room.game.submitAction(senderId, data);
    }
    if (event === 'leave room') {
       room.removePlayer(clientSocket);
    }
  }

  removeAllListeners(event) {
    delete this.listeners[event];
  }
}

const socket = new RealtimeSocket();
export default socket;