import crypto from 'crypto';
import gameCreator from './Game';
const ROOM_STATUS_PREGAME = 0
const ROOM_STATUS_PLAYING = 1
const ROOM_STATUS_POSTGAME = 2

export default function (io) {
  const {GameDice, GameSpaceSpy, GameWordWar, GamePakklongCard, GamePakklongBoard} = gameCreator(io)
  class Room {
    constructor(gameTitle) {
      this.gameTitle = gameTitle;
      this.public = true;
      this.players = {};
      this.hostUserID = {};
      this.roomID = generateRoomID(); //random 4-capital-letter string
      this.status = ROOM_STATUS_PREGAME
      this.game = null;
      this.maxPlayers = 10;
    }

    addPlayer(socket){
      this.players[socket.data.userID] = socket
      if(Object.keys(this.players).length == 1)
        this.hostUserID = socket.data.userID
      socket.join(this.roomID)
      socket.data.roomID = this.roomID
      io.to(this.roomID).emit('add player', {userID:socket.userID, username:socket.username})
    }

    removePlayer(socket){
      if (!(socket.data.userID in this.players))
        return;
      
      delete this.players[socket.data.userID]
      delete socket.data.roomID
      socket.leave(this.roomID)
      io.to(this.roomID).emit('remove player', {userID:socket.userID, username:socket.username})
      return Object.keys(this.players).length === 0 // true if room is now empty
    }

    attemptToStart(configs){
      if(this.game === null) {
        switch(this.gameTitle) {
          case 'pakklongdice': this.game = new GameDice(this.gameTitle, configs, this.players, this.roomID); break;
          case 'spacespy': this.game = new GameSpaceSpy(this.gameTitle, configs, this.players, this.roomID); break;
          case 'pakklongcard': this.game = new GamePakklongCard(this.gameTitle, configs, this.players, this.roomID); break;
          case 'pakklongboard': this.game = new GamePakklongBoard(this.gameTitle, configs, this.players, this.roomID); break;
          case 'wordwars': this.game = new GameWordWar(this.gameTitle, configs, this.players, this.roomID); break;
          default: break;
        }
      }
      else 
        if(this.game.isPlaying)
          return false
        else
          this.game.restart(configs)
      
      io.to(this.roomID).emit('new game', this.game.gameInfo())
      this.game.newRound()
      this.status = ROOM_STATUS_PLAYING
      return true
    }

    isPublic(){
      return this.public
    }

    roomInfo(){
      return{
        gameTitle: this.gameTitle,
        public: this.public,
        players: Object.entries(this.players).map(([k,v]) => v.data.username), // return array of usernames instead of sockets
        hostUserID: this.hostUserID,
        roomID: this.roomID,
        status: this.status
      }
    }
  }

  class RoomList{
    constructor() {
      this.rooms = {}
      if (process.env.NODE_ENV !== 'production') {
        this.addDummyRooms() // for debugging purpose
      }
    }

    addDummyRooms(){
      this.newRoom('pakklongdice')
      this.newRoom('pakklongboard')
    }

    newRoom(title) {
      const room = new Room(title)
      this.rooms[room.roomID] = room
      return room.roomID
    }

    findRoomById(id) {
      return (id in this.rooms)? this.rooms[id]: null
    }

    removeRoom(id) {
      delete this.rooms[id]
      io.emit('room removed', id)
    }

    // utility to remove and delete room if needed
    removePlayer(socket, id) {
      const room = this.findRoomById(id)
      if (!room) {
        return socket.emit(
          'err',
          'Could not leave requested room because it doesn not exist'
        )
      }
      const isEmpty = room.removePlayer(socket)
      if (isEmpty) {
        this.removeRoom(id)
      }
    }

    filterByTitle(title){
      // return [[roomID, {roomInfo}],...]
      return Object.entries(this.rooms).filter(([k,v]) => v.gameTitle === title).map(([k,v]) => [k,v.roomInfo()])
    }

    attemptToJoin(roomID){
      var returnedMessage = {available: false, errorMessage: 'empty', gameTitle: ''}
      if (!(roomID in this.rooms))
        returnedMessage.errorMessage = 'room does not exist'
      else if (!this.rooms[roomID].public)
        returnedMessage.errorMessage = 'room is private'
      else if (this.rooms[roomID].maxPlayers <= Object.entries(this.rooms[roomID].players).length)  
        returnedMessage.errorMessage = 'room is full'
      else {
        returnedMessage.available = true
        returnedMessage.gameTitle = this.rooms[roomID].gameTitle
      }
      return returnedMessage
    }
  }



  return{
    Room,
    RoomList
  }
}

function generateRoomID(){
  var s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var randomstr = '';
  for (let i = 0; i < 4; i++) {
    randomstr += s.charAt(crypto.randomInt(0, s.length));
  }
  return randomstr
}
