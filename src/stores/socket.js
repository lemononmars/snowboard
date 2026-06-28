import { supabase } from '../supabase.js';
import nameGen from '../game/name.js';
import RoomCreator from '../game/Room.js';

// ─── io shim factory ────────────────────────────────────────────────────────
// Constructs a minimal io-compatible object that Room.js / Game.js call into.
// `getChannel` is a lazy getter so it always resolves the current channel reference.
function makeIoShim(getChannel, handleLocalEvent) {
  return {
    to: (_roomID) => ({
      emit: (event, data) => {
        const ch = getChannel();
        if (ch) {
          if (ch.state === 'joined') {
            ch.send({ type: 'broadcast', event, payload: { event, data } });
          } else {
            ch.httpSend(event, { event, data });
          }
        }
        // Deliver locally to the host too
        handleLocalEvent(event, data);
      }
    }),
    emit: (event, data) => {
      const ch = getChannel();
      if (ch) {
        if (ch.state === 'joined') {
          ch.send({ type: 'broadcast', event, payload: { event, data } });
        } else {
          ch.httpSend(event, { event, data });
        }
      }
      handleLocalEvent(event, data);
    }
  };
}

class RealtimeSocket {
  constructor() {
    this.listeners = {};
    this.callbacks = {};
    this.msgId = 0;

    this.data = {
      userID: '',
      username: '',
      roomID: 'lobby'
    };

    // Supabase channels
    this.lobbyChannel = null;
    this.personalChannel = null;
    this.roomChannel = null;

    // Lobby ready flag — track() silently fails before SUBSCRIBED
    this._lobbyReady = false;
    this._pendingPresence = false; // queued track call

    // Host-side room state (only set for the room creator)
    this.hostedRoom = null;
    this.currentGameTitle = null;

    // Room discovery cache — merged from room_announce broadcasts
    // Map<roomID, roomInfo>
    this._roomCache = new Map();
    this._heartbeatInterval = null;

    // io shim used by Room.js / Game.js
    this._io = makeIoShim(
      () => this.roomChannel,
      (event, data) => this.handleLocalEvent(event, data)
    );

    if (typeof window !== 'undefined') {
      this.data.userID = Math.random().toString(36).substr(2, 9);
      this.data.username = nameGen();

      // ── Lobby channel ──────────────────────────────────────────────────────
      this.lobbyChannel = supabase.channel('lobby', {
        config: {
          broadcast: { ack: false }
        }
      });

      this.lobbyChannel
        .on('presence', { event: 'sync' }, () => this._handlePresenceSync())
        .on('presence', { event: 'join' }, () => this._handlePresenceSync())
        .on('presence', { event: 'leave' }, () => this._handlePresenceSync())
        // ── Broadcast-based room discovery ────────────────────────────────
        .on('broadcast', { event: 'room_announce' }, (msg) => {
          // A host is announcing their room — merge into cache
          const room = msg.payload?.room;
          if (room?.roomID) {
            this._updateRoomCache(room);
          }
        })
        .on('broadcast', { event: 'room_removed' }, (msg) => {
          // A host closed their room — remove from cache
          const roomID = msg.payload?.roomID;
          if (roomID) {
            this._removeFromRoomCache(roomID);
          }
        })
        .on('broadcast', { event: 'request_rooms' }, () => {
          // Another client wants the room list — respond if we're a host
          if (this.hostedRoom && this._lobbyReady) {
            // Small jitter to avoid thundering herd
            setTimeout(() => this._broadcastRoomAnnounce(), Math.random() * 300);
          }
        })
        .on('broadcast', { event: 'lobby_update' }, (msg) => {
          // Legacy: keep accepting old-style full-list broadcasts
          const { rooms: updatedRooms } = msg.payload || {};
          if (Array.isArray(updatedRooms)) {
            this.handleLocalEvent('update rooms', updatedRooms);
          }
        })
        .on('broadcast', { event: '*' }, (msg) => {
          const skip = ['room_announce','room_removed','request_rooms','lobby_update'];
          if (!skip.includes(msg.event)) {
            this._handleMessage(msg.payload);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            this._lobbyReady = true;
            // Track our own presence
            await this._trackPresence();
            // Fire a sync so the UI updates immediately from presence state
            this._handlePresenceSync();
            // Ask all hosts to announce their rooms
            this.lobbyChannel.send({
              type: 'broadcast',
              event: 'request_rooms',
              payload: { from: this.data.userID }
            }).catch(() => {});
            if (this._pendingPresence) {
              this._pendingPresence = false;
              this._handlePresenceSync();
            }
          }
        });

      // Host heartbeat — announce room every 6s so late joiners see it
      this._heartbeatInterval = setInterval(() => {
        if (this.hostedRoom && this._lobbyReady) {
          this._broadcastRoomAnnounce();
        }
      }, 6000);

      // ── Personal channel (for callbacks from host → client) ──────────────────
      // Supabase delivers: { event: string, payload: {...} }
      // but our messages are stored inside payload.payload because we set payload: { event, data, ... }
      // So we listen with event: '*' and pull from the message directly.
      this.personalChannel = supabase.channel(`user_${this.data.userID}`, {
        config: { broadcast: { ack: false } }
      });
      this.personalChannel
        .on('broadcast', { event: '*' }, (msg) => {
          // msg.payload is our inner payload object: { event, data, callbackId }
          this._handleMessage(msg.payload);
        })
        .subscribe();

      // Subscribe to real-time changes on the rooms table
      this.roomsDbChannel = supabase
        .channel('rooms-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms' },
          async (payload) => {
            console.log('[socket] rooms table changed:', payload);
            if (this.currentGameTitle) {
              const { data: dbRooms, error } = await supabase
                .from('rooms')
                .select('*')
                .eq('game_title', this.currentGameTitle);
              
              if (!error && dbRooms) {
                const results = dbRooms.map(r => [
                  r.room_id,
                  {
                    roomID: r.room_id,
                    gameTitle: r.game_title,
                    public: r.is_public,
                    players: r.players.map(p => p.username),
                    hostUserID: r.host_user_id,
                    status: r.status
                  }
                ]);
                this.handleLocalEvent('update rooms', results);
              }
            }
          }
        )
        .subscribe();

      // Deliver initial user info to the app once the store is ready
      setTimeout(() => {
        this.handleLocalEvent('initialize user', { ...this.data });
      }, 300);
    }
  }

  // ── Presence ─────────────────────────────────────────────────────────────────

  _handlePresenceSync() {
    if (!this.lobbyChannel) return;
    const state = this.lobbyChannel.presenceState();
    console.log('[socket] lobby presence sync state:', JSON.stringify(state, null, 2));
    const players = [];
    const roomMap = new Map();

    for (const entries of Object.values(state)) {
      for (const p of entries) {
        if (p.userID) {
          players.push({ userID: p.userID, username: p.username });
        }
        if (p.rooms) {
          for (const r of p.rooms) {
            if (r && r.roomID && !roomMap.has(r.roomID)) {
              roomMap.set(r.roomID, r);
            }
          }
        }
      }
    }

    this.handleLocalEvent('update online players', players);
    this.handleLocalEvent('update rooms', [...roomMap.entries()]);
  }

  _getHostedRoomInfo() {
    if (!this.hostedRoom) return [];
    return [{
      roomID: this.hostedRoom.roomID,
      gameTitle: this.hostedRoom.gameTitle,
      public: this.hostedRoom.public,
      players: Object.values(this.hostedRoom.players).map(
        p => p.data?.username || p.username || 'Player'
      ),
      hostUserID: this.hostedRoom.hostUserID,
      status: this.hostedRoom.status
    }];
  }

  async _trackPresence() {
    // Don't try to track until the lobby channel is subscribed
    if (!this.lobbyChannel || !this._lobbyReady) {
      this._pendingPresence = true;
      return;
    }
    try {
      const roomInfo = this._getHostedRoomInfo();
      await this.lobbyChannel.track({
        userID: this.data.userID,
        username: this.data.username,
        rooms: roomInfo
      });
    } catch (e) {
      console.warn('[socket] presence track failed:', e);
    }
  }

  // ── Broadcast-based room discovery helpers ────────────────────────────────

  _broadcastRoomAnnounce() {
    if (!this.lobbyChannel || !this._lobbyReady || !this.hostedRoom) return;
    const roomInfo = this._getHostedRoomInfo()[0];
    if (!roomInfo) return;
    // Also update our own cache so we see our own room
    this._updateRoomCache(roomInfo);
    if (this.lobbyChannel.state === 'joined') {
      this.lobbyChannel.send({
        type: 'broadcast',
        event: 'room_announce',
        payload: { room: roomInfo }
      }).catch(() => {});
    }
  }

  _broadcastRoomRemoved(roomID) {
    if (!this.lobbyChannel || !this._lobbyReady) return;
    this._removeFromRoomCache(roomID);
    if (this.lobbyChannel.state === 'joined') {
      this.lobbyChannel.send({
        type: 'broadcast',
        event: 'room_removed',
        payload: { roomID }
      }).catch(() => {});
    }
  }

  _updateRoomCache(room) {
    if (!room?.roomID) return;
    this._roomCache.set(room.roomID, room);
    // Fire update event filtered to current game title
    const all = [...this._roomCache.entries()]; // [[roomID, roomInfo]]
    this.handleLocalEvent('update rooms', all);
  }

  _removeFromRoomCache(roomID) {
    this._roomCache.delete(roomID);
    const all = [...this._roomCache.entries()];
    this.handleLocalEvent('update rooms', all);
  }

  _broadcastLobbyUpdate() {
    // Legacy shim — just re-announce our own room
    this._broadcastRoomAnnounce();
  }

  // ── Message handling ─────────────────────────────────────────────────────────

  _handleMessage(payload) {
    if (!payload) return;
    const { event, data, callbackId } = payload;

    // Deliver to registered listeners
    if (event && this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }

    // Resolve callbacks (from host replies)
    if (callbackId && this.callbacks[callbackId]) {
      if (data && data.players) {
        data.players.forEach(p => {
          this.handleLocalEvent('add player', { userID: p.userID, username: p.username });
        });
      }
      this.callbacks[callbackId](data);
      delete this.callbacks[callbackId];
    }
  }

  handleLocalEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // ── Room channel setup ────────────────────────────────────────────────────────

  _joinRoomChannel(roomID) {
    if (this.roomChannel) return; // already subscribed
    this.data.roomID = roomID;

    const channel = supabase.channel(`room_${roomID}`, {
      config: {
        broadcast: { ack: false }
      }
    });

    channel
      .on('broadcast', { event: '*' }, (msg) => {
        // msg.payload is our inner payload: { event, data, senderId, callbackId }
        const payload = msg.payload;
        // Deliver to all listeners (including the host's own UI)
        this._handleMessage(payload);
        // If I'm the host, process incoming player actions
        this._handleAsHost(payload);
      })
      .on('presence', { event: 'sync' }, () => this._handleRoomPresenceSync())
      .on('presence', { event: 'join' }, () => this._handleRoomPresenceSync())
      .on('presence', { event: 'leave' }, () => this._handleRoomPresenceSync())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              userID: this.data.userID,
              username: this.data.username
            });
          } catch (e) {
            console.warn('[socket] room presence track failed:', e);
          }
        }
      });

    this.roomChannel = channel;
  }

  _handleRoomPresenceSync() {
    if (!this.roomChannel || !this.hostedRoom) return;
    const state = this.roomChannel.presenceState();
    console.log('[socket] room presence sync state:', JSON.stringify(state, null, 2));
    const onlineUserIds = new Set();
    
    for (const entries of Object.values(state)) {
      for (const p of entries) {
        if (p.userID) {
          onlineUserIds.add(p.userID);
        }
      }
    }

    // Prune players who are no longer present in the room channel
    for (const userID in this.hostedRoom.players) {
      if (userID !== this.data.userID && userID !== this.hostedRoom.hostUserID && !onlineUserIds.has(userID)) {
        console.log(`[socket] host removing disconnected room player: ${userID}`);
        const clientSocket = this.hostedRoom.players[userID];
        if (clientSocket) {
          const isEmpty = this.hostedRoom.removePlayer(clientSocket);
          if (isEmpty) {
            this.hostedRoom = null;
            this.data.roomID = 'lobby';
            if (this.roomChannel) {
              this.roomChannel.unsubscribe();
              this.roomChannel = null;
            }
            this._syncRoomStateToDb(roomID); // deletes empty room from DB
          } else {
            this._syncRoomStateToDb(); // updates players list in DB
          }
          this._trackPresence();
        }
      }
    }
  }

  async _syncRoomStateToDb(roomIDToClean = null) {
    const roomID = roomIDToClean || (this.hostedRoom ? this.hostedRoom.roomID : null);
    if (!roomID) return;

    const playersList = this.hostedRoom
      ? Object.values(this.hostedRoom.players).map(p => ({
          userID: p.data?.userID || p.userID,
          username: p.data?.username || p.username
        }))
      : [];

    if (playersList.length === 0) {
      console.log(`[socket] deleting empty room ${roomID} from DB`);
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('room_id', roomID);
      if (error) console.error('[socket] error deleting empty room from DB:', error);
    } else {
      console.log(`[socket] syncing players of room ${roomID} to DB:`, playersList);
      const { error } = await supabase
        .from('rooms')
        .update({
          players: playersList,
          status: this.hostedRoom.status
        })
        .eq('room_id', roomID);
      if (error) console.error('[socket] error syncing room state to DB:', error);
    }
  }

  // ── Host-side event processing ────────────────────────────────────────────────
  // Only executes if this client created the room (this.hostedRoom !== null)

  _handleAsHost(payload) {
    if (!this.hostedRoom) return;
    const { event, data, senderId, callbackId } = payload;

    // Skip events that originated from myself (host) unless it's a local invocation
    if (senderId === this.data.userID && !payload._isLocal) return;

    // Helper: reply directly to sender's personal channel
    const reply = (res) => {
      if (!senderId) return;
      const ch = supabase.channel(`user_${senderId}`);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'reply',
            payload: { event: 'reply', data: res, callbackId }
          });
          setTimeout(() => ch.unsubscribe(), 800);
        }
      });
    };

    // Minimal mock socket for the remote client
    const clientSocket = {
      data: {
        userID: senderId,
        username: data?.username || 'Player'
      },
      join: () => {},
      leave: () => {},
      on: () => {},
      removeAllListeners: () => {},
      emit: (e, d) => {
        if (!senderId) return;
        const ch = supabase.channel(`user_${senderId}`);
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch.send({ type: 'broadcast', event: e, payload: { event: e, data: d } });
            setTimeout(() => ch.unsubscribe(), 800);
          }
        });
      }
    };

    if (event === 'join room') {
      this.hostedRoom.addPlayer(clientSocket);
      this._trackPresence(); // will also broadcast lobby_update
      this._broadcastRoomAnnounce(); // update player count for all lobby viewers
      this._syncRoomStateToDb();
      
      const existingPlayers = Object.values(this.hostedRoom.players).map(p => ({
        userID: p.data?.userID || p.userID,
        username: p.data?.username || p.username
      }));
      reply({ successful: true, players: existingPlayers });
    }

    if (event === 'start game') {
      this.hostedRoom.attemptToStart(data);
      this._trackPresence();
      this._syncRoomStateToDb();
    }

    if (event === 'submit action') {
      if (this.hostedRoom.game) {
        this.hostedRoom.game.submitAction(senderId, data);
      }
    }

    if (event === 'abort') {
      this.hostedRoom.status = 0;
      if (this.hostedRoom.game) {
        this.hostedRoom.game.abort();
      }
      this._trackPresence();
      this._syncRoomStateToDb();
    }

    if (event === 'leave room') {
      const roomID = this.hostedRoom.roomID;
      const isEmpty = this.hostedRoom.removePlayer(clientSocket);
      if (isEmpty) {
        this.hostedRoom = null;
        this.data.roomID = 'lobby';
        this._syncRoomStateToDb(roomID); // delete from DB
        this._broadcastRoomRemoved(roomID); // remove from all lobby clients
      } else {
        this._syncRoomStateToDb(); // update players array in DB
        this._broadcastRoomAnnounce(); // update player count for lobby clients
      }
      this._trackPresence();
    }
  }

  // ── Public API (backward-compatible with existing Svelte pages) ───────────────

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  removeAllListeners(event) {
    delete this.listeners[event];
  }

  emit(event, data, callback) {
    // Normalize: emit(event, callback)
    if (typeof data === 'function') {
      callback = data;
      data = null;
    }

    let callbackId = null;
    if (callback) {
      callbackId = ++this.msgId;
      this.callbacks[callbackId] = callback;
    }

    const eventMapping = {
      'give starting stuff': 'starting stuff recieved',
      'generate market': 'market generated',
      'take action': 'action taken',
      'arrange flower': 'flower arranged',
      'finish arranging': 'player finished arranging',
      'submit time tokens': 'time tokens submitted',
      'end phase': 'to next phase',
      'game end': 'game finished',
      'toggle autoplay': 'autoplay toggled'
    };

    const mappedEvent = eventMapping[event] || event;

    const payload = {
      event: mappedEvent,
      data,
      callbackId,
      senderId: this.data.userID
    };

    // ── Sync username / ID changes ────────────────────────────────────────────
    if (event === 'use local storage') {
      this.data.userID = data.userID;
      this.data.username = data.username;
      this._trackPresence();
      return;
    }

    // ── Create room (host only) ───────────────────────────────────────────────
    if (event === 'create room') {
      const { Room } = RoomCreator(this._io);
      this.hostedRoom = new Room(data.gameTitle);
      const newRoomID = this.hostedRoom.roomID;

      this._joinRoomChannel(newRoomID);

      // Add self as the first player
      const selfSocket = {
        data: { userID: this.data.userID, username: this.data.username },
        join: () => {},
        leave: () => {},
        on: () => {},
        removeAllListeners: () => {},
        emit: (e, d) => this.handleLocalEvent(e, d)
      };
      this.hostedRoom.addPlayer(selfSocket);

      // Save to database (best-effort, not required)
      const insertDb = async () => {
        const { error } = await supabase
          .from('rooms')
          .insert({
            room_id: newRoomID,
            game_title: data.gameTitle,
            host_user_id: this.data.userID,
            players: [{ userID: this.data.userID, username: this.data.username }],
            status: 0,
            is_public: data.public ?? true
          });
        if (error) {
          console.error('[socket] error creating room in DB:', error);
        }
      };
      insertDb();

      // Announce the new room to all lobby browsers via broadcast
      this._trackPresence();
      setTimeout(() => this._broadcastRoomAnnounce(), 300);

      if (callback) callback(newRoomID);
      return;
    }

    // ── Get rooms ─────────────────────────────────────────────────────────────
    if (event === 'get rooms') {
      const gameTitle = data;
      this.currentGameTitle = gameTitle;

      // 1. Return whatever we have cached right now (may be empty on first load)
      const cached = [...this._roomCache.entries()]
        .filter(([, r]) => r.gameTitle === gameTitle);
      if (callback) callback(cached);

      // 2. Ask all hosts to announce — responses come via 'update rooms' listener
      if (this._lobbyReady) {
        this.lobbyChannel?.send({
          type: 'broadcast',
          event: 'request_rooms',
          payload: { from: this.data.userID }
        }).catch(() => {});
      }
      return;
    }

    // ── Join room ─────────────────────────────────────────────────────────────
    if (event === 'join room') {
      const roomID = data?.roomID || data;
      this._joinRoomChannel(roomID);

      // If I'm the host of this room, already added during create room
      if (this.hostedRoom && this.hostedRoom.roomID === roomID) {
        const existingPlayers = Object.values(this.hostedRoom.players).map(p => ({
          userID: p.data?.userID || p.userID,
          username: p.data?.username || p.username
        }));
        if (callback) callback({ successful: true, players: existingPlayers });
        return;
      }

      // Non-host: wait for room channel to be ready then broadcast join
      const doJoin = () => {
        if (this.roomChannel) {
          if (this.roomChannel.state === 'joined') {
            this.roomChannel.send({ type: 'broadcast', event, payload });
          } else {
            this.roomChannel.httpSend(event, payload);
          }
        }
      };
      // Small delay to ensure channel is subscribed
      setTimeout(doJoin, 200);
      return;
    }

    // ── join lobby (no-op, presence handles everything) ───────────────────────
    if (event === 'join lobby') {
      return;
    }

    // ── try joining room (check availability) ────────────────────────────────
    if (event === 'try joining room') {
      const roomID = data;

      // First check the local room cache (populated by room_announce broadcasts)
      const cached = this._roomCache.get(roomID);
      if (cached) {
        let result;
        if (cached.status > 0) {
          result = { available: false, errorMessage: 'game already in progress', gameTitle: cached.gameTitle };
        } else if (cached.players && cached.players.length >= 10) {
          result = { available: false, errorMessage: 'room is full', gameTitle: cached.gameTitle };
        } else {
          result = { available: true, errorMessage: '', gameTitle: cached.gameTitle };
        }
        if (callback) callback(result);
        return;
      }

      // Fallback: check DB
      const checkDb = async () => {
        const { data: dbRoom, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_id', roomID)
          .single();

        let result = { available: false, errorMessage: 'room does not exist', gameTitle: '' };
        if (!error && dbRoom) {
          if (dbRoom.status > 0) {
            result = { available: false, errorMessage: 'game already in progress', gameTitle: dbRoom.game_title };
          } else if (dbRoom.players && dbRoom.players.length >= 10) {
            result = { available: false, errorMessage: 'room is full', gameTitle: dbRoom.game_title };
          } else {
            result = { available: true, errorMessage: '', gameTitle: dbRoom.game_title };
          }
        } else if (error) {
          // If we reach here without a cache hit, just allow entry (the room channel join will fail gracefully)
          console.warn('[socket] room not in cache or DB — allowing optimistic join');
          result = { available: true, errorMessage: '', gameTitle: this.currentGameTitle || '' };
        }
        if (callback) callback(result);
      };
      checkDb();
      return;
    }

    // ── Room-level events: broadcast on room channel ──────────────────────────
    const baseRoomEvents = ['start game', 'submit action', 'abort', 'leave room'];
    const customRoomEvents = [
      'give starting stuff', 'generate market', 'take action',
      'arrange flower', 'finish arranging', 'submit time tokens',
      'end phase', 'game end', 'toggle autoplay'
    ];

    if (baseRoomEvents.includes(event) || customRoomEvents.includes(event)) {
      if (this.roomChannel) {
        if (this.roomChannel.state === 'joined') {
          this.roomChannel.send({ type: 'broadcast', event: mappedEvent, payload });
        } else {
          this.roomChannel.httpSend(mappedEvent, payload);
        }
      }

    if (event === 'leave room') {
      const roomID = this.hostedRoom?.roomID || data?.roomID || data;
      if (this.roomChannel) {
        this.roomChannel.unsubscribe();
        this.roomChannel = null;
      }
      this.data.roomID = 'lobby';
      // Broadcast removal so other lobby browsers remove this room immediately
      if (roomID) this._broadcastRoomRemoved(roomID);
    }

      if (baseRoomEvents.includes(event)) {
        // If I'm the host, handle locally too
        payload._isLocal = true;
        this._handleAsHost(payload);
      } else {
        // Custom board game events: deliver locally to ourselves (except for 'action taken')
        if (mappedEvent !== 'action taken') {
          this.handleLocalEvent(mappedEvent, data);
        }
      }
      return;
    }

    // ── Default: lobby broadcast ──────────────────────────────────────────────
    if (this.lobbyChannel) {
      if (this.lobbyChannel.state === 'joined') {
        this.lobbyChannel.send({ type: 'broadcast', event, payload });
      } else {
        this.lobbyChannel.httpSend(event, payload);
      }
    }
  }

  sendGlobalChat(text) {
    const data = {
      message: text,
      username: this.data.username,
      userID: this.data.userID,
      timestamp: new Date().toISOString()
    };
    const payload = {
      event: 'global chat message',
      data,
      senderId: this.data.userID
    };
    if (this.lobbyChannel) {
      if (this.lobbyChannel.state === 'joined') {
        this.lobbyChannel.send({ type: 'broadcast', event: 'global chat message', payload });
      } else {
        this.lobbyChannel.httpSend('global chat message', payload);
      }
    }
    this.handleLocalEvent('global chat message', data);
  }

  sendRoomChat(text) {
    const data = {
      message: text,
      username: this.data.username,
      userID: this.data.userID,
      timestamp: new Date().toISOString()
    };
    const payload = {
      event: 'room chat message',
      data,
      senderId: this.data.userID
    };
    if (this.roomChannel) {
      if (this.roomChannel.state === 'joined') {
        this.roomChannel.send({ type: 'broadcast', event: 'room chat message', payload });
      } else {
        this.roomChannel.httpSend('room chat message', payload);
      }
    }
    this.handleLocalEvent('room chat message', data);
  }
}

const socket = new RealtimeSocket();
export default socket;