import RoomCreator from './Room'
import nameGen from './name';

export default function (io) {
  var users = []
  users['0000'] = 'Dummy user'
  const {RoomList} = RoomCreator(io)
  const rooms = new RoomList();
 
  io.on('connection', function(socket){
    // initialize a new user
    socket.data.username = nameGen()
    socket.data.userID = socket.id
    socket.data.roomID = 'lobby'
    users[socket.data.userID] = socket.data.username
    console.log(socket.data.userID + ' joined')
    socket.emit('initialize user', socket.data)

    // for debuging 
    socket.onAny((event, ...args) => {
      console.log(event, args);
    });
  
    // disconnect the user
    socket.on('disconnect', ()=>{
      delete users[socket.data.userID];
      io.to(socket.data.roomID).emit('remove player', socket.data);
    });
  
    socket.on('create room', (data, func)=>{
      var newRoom = rooms.newRoom(data.gameTitle)
      io.to(data.gameTitle).emit('update rooms', rooms.filterByTitle(data.gameTitle))
      func(newRoom)
    });
  
    socket.on('try joining room', (roomID, func) => {
        var rm = rooms.attemptToJoin(roomID)
        func(rm)
    });
  
    socket.on('join room', (data, func) =>{
      if(rooms.findRoomById(data) == null) {
        func({successful: false})
        return
      }
      rooms.findRoomById(data).addPlayer(socket)
    })

    socket.on('leave room', data =>{
      rooms.removePlayer(socket, data)
      socket.join('lobby')
    })
  
    socket.on('join lobby', slug=>{
      socket.join(slug)
    })

    socket.on('get rooms', (title, func) => {
      func(rooms.filterByTitle(title))
    })
  
    socket.on('edit name', (data) =>{
      users[data.userID] = data.username
      io.emit("update users", users);
    });

    socket.on('start game', (data) =>{
      rooms.rooms[socket.data.roomID].attemptToStart(data)  
    });
  });
}  