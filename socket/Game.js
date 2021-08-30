export default function (io) {
  // TODO: add subclasses for different games
  class Game{
    constructor(gameTitle, gameConfigs, players, roomID){
      this.gameConfigs = gameConfigs // shuffle, chosenTheme, gameLength, etc.
      this.gameTitle = gameTitle
      this.players = players // players[socket.data.userID] = socket
      this.roomID = roomID
      this.gameConfigs['solo'] = Object.keys(this.players).length == 1 // add a new config
      this.isPlaying = true;

      this.addListeners()
    }

    removePlayer(socket){
      if(socket.data.userID in this.players) {
        delete this.players[socket.data.userID]
        this.removeListeners()
      }
      // TODO: add consequences?
    }

    
    gameInfo(){
      return{
        gameConfigs: this.gameConfigs,
        gameTitle: this.gameTitle,
        activePlayer: this.activePlayer,
        playerInfo: this.playerInfo,
        gameComponents: this.gameComponents,
        roundInfo: this.roundInfo
      }
    }

    // add listeners to those in the game
    addListeners(){
      for (const p in this.players) {
        const v = this.players[p]
        v.on('submit action', action => this.submitAction(v.data.userID, action))
        v.on('abort', () => this.abort())
      }
    }

    removeListeners(){
      for (const p in this.players) {
        const v = this.players[p]
        v.removeAllListeners('submit action')
        v.removeAllListeners('abort')
      }
    }

    abort(){
      this.roundInfo.round = this.gameConfigs.roundLength // maybe there's a better way..... like state
      io.to(this.roomID).emit('end round', this.gameInfo())
      this.gameEnd()
    }

    shuffleArray(array) {
      for (var i = array.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = array[i];
          array[i] = array[j];
          array[j] = temp;
      }
    }
  }

  class GameDice extends Game{
    constructor(gameTitle, gameConfigs, players, roomID){
      super(gameTitle, gameConfigs, players, roomID)

      this.maxPlayers = 10
      this.timeOut = 0

      // initialize playerInfo dictionary
      this.playerInfo = {
        usernames: {},
        scores: {},
        actions: {}
      }
      for (const s in this.players){
        var p = this.players[s]
        this.playerInfo.usernames[p.data.userID] = p.data.username
        this.playerInfo.scores[p.data.userID] = 0
      }
      this.gameComponents = {dice: []}
      this.roundInfo = {
        round: 0,
        roundStartTime: 0,
        roundAnswer: -1,
      }
    }

    restart(configs){
      this.gameConfigs = configs
      this.playerInfo = {
        usernames: {},
        scores: {},
        actions: {}
      }
      for (const s in this.players){
        var p = this.players[s]
        this.playerInfo.usernames[p.data.userID] = p.data.username
        this.playerInfo.scores[p.data.userID] = 0
      }
      this.gameComponents = {dice: []}
      this.roundInfo = {
        round: 0,
        roundStartTime: 0,
        roundAnswer: -1,
      }
    }
    
    newRound(){
      var dice_pool=[
          [0,1,2], [0,1,3], [0,2,3], [1,2,3]
      ]
      var dice_set = []
      var diff = this.gameConfigs.difficulty
      switch(diff){
          case 1: 
            var t = Math.floor(Math.random()*3)
            dice_set = [t,t,t]; break;
          case 2: 
            var t1 = Math.floor(Math.random()*3)
            var t2 = (t1+1)%3
            dice_set = [t1,t1,t1,t2,t2]; break;
          case 3: dice_set = [0,0,0,1,1,1,2,2,2]; break;
          default: dice_set = [0,0,0,1,1,1,2,2,2,3,3,3]; break; // for advanced mode
      }
    
      var dice = []
      var dice_ans = []
      for (var i = 0; i < dice_set.length; i++){
          const die = dice_pool[dice_set[i]][Math.floor(Math.random()*3)]
          dice.push({'color':dice_set[i], 'type':die})
          dice_ans.push(die)
      }
    
      /* find solution (before shuffling if needed) */
      var answer = -1
      if (diff == 1)
        answer = this.get_answer(dice_ans.slice(0,3))
      else if (diff == 2){
        var a1 = this.get_answer(dice_ans.slice(0,3))
        var newf = dice_ans.slice(3,5)
        newf.push(a1)
        answer = this.get_answer(newf)
      }
      else if (diff == 3){
        var a1 = this.get_answer(dice_ans.slice(0,3))
        var a2 = this.get_answer(dice_ans.slice(3,6))
        var a3 = this.get_answer(dice_ans.slice(6,9))
        answer = this.get_answer([a1, a2, a3])
      }
      else
        answer = -1 // level 4: to be added later
    
      if (this.gameConfigs.shuffle)
          this.shuffleArray(dice)
    
      this.roundInfo.round ++
      this.roundInfo.roundAnswer = answer
      var d = new Date()
      this.roundInfo.roundStartTime = d.getTime() + 5000 // start after 5-second cooldown
      this.gameComponents.dice = dice
      this.playerInfo.actions = {} // clear actions each round because in this game you can only answer once
      this.timeOut = setTimeout(this.roundEnd.bind(this), 15000) // 5 seconds cool-down + 10 seconds gameplay
      io.to(this.roomID).emit('new round', this.gameInfo())
    }
    
    roundEnd(){
      clearTimeout(this.timeOut)
      this.computeScore()
      io.to(this.roomID).emit('end round', this.gameInfo());

      if (this.roundInfo.round == this.gameConfigs.gameLength)  
        this.gameEnd()
      else
        this.newRound()
    }
    
    gameEnd(){
      io.to(this.roomID).emit('end game', this.gameInfo())
      clearTimeout(this.timeOut)
      this.isPlaying = false
    }
    
    computeScore(){
      var correctAnswer = this.roundInfo.roundAnswer
      var answers = this.playerInfo.actions

      // no answer = 0
      // incorrect -> (-10)*number of incorrect players faster than you
      // i.e. still the faster, the better!
      var correctPlayers = []
      var penalty = 0;
      for (const id in this.playerInfo.usernames){
        // see if that player took an action
        if(id in answers){
          if (answers[id].action === correctAnswer)
            correctPlayers.push([id, answers[id].time])
          else {
            penalty = 10*(penalty++)
            this.playerInfo.scores[id] -= penalty
            this.playerInfo.actions[id].roundScore = -penalty
          }
        }
      }
    
      // find out who answers correctly first and award points according to submission time
      if(correctPlayers.length > 0){
        correctPlayers.sort(function(first, second){
          return first[1] - second[1]
        });
    
        var fastest_time = 0
        // for solo mode, start from server time
        if(this.gameConfigs.solo)
          fastest_time = this.roundInfo.roundStartTime
        else
          fastest_time = correctPlayers[0][1]
        for (const cp in correctPlayers){
          // faster one gets 100 points
          // 1 point of for each 0.1 seconds behind the fastest
          const maxScore = this.gameConfigs.solo? 150:100
          var bonus = maxScore + Math.floor((fastest_time - correctPlayers[cp][1])/100);
          this.playerInfo.scores[correctPlayers[cp][0]] += bonus
          this.playerInfo.actions[correctPlayers[cp][0]].roundScore = bonus
        }
      }
    }

    get_answer(f){
      var a = -1
      if (f[0] == f[1])
          if (f[0] == f[2])
            a = f[0]
          else
            a = f[2]
      else if (f[0] == f[2])
            a = f[1]
          else if (f[1] == f[2])
            a = f[0]
          else 
            a = 6-f[0]-f[1]-f[2]
      return a
    }

    submitAction(id, action){
      this.playerInfo.actions[id] = action
      var d = new Date()
      action.time = d.getTime() // add time 
      io.to(this.roomID).emit('update answers', {userID: id, action: action}) 
      if (Object.keys(this.playerInfo.usernames).length == Object.keys(this.playerInfo.actions).length)
        this.roundEnd()
    }
  }

  class GameSpaceSpy extends Game{

  }

  class GameWordWar extends Game{
    constructor() {

    }

    getLetter(){
      const letters = ['า','ร','น','ก','อ','เ','ง','ม','ย','ว','ท','ด','ล','ต','ห','ส','บ','ะ','ค','ป','จ','แ','ไ','พ','ข','ใ','ช','โ','ธ','ผ','ศ','ถ','ณ','ซ','ษ','ญ','ภ','ฐฑฒ','ฟฝ','ฉฌฆ','ฤฦ','ฎฏ','ฮฬ','่','้','ั','ิ','ี','ุ','ื','์','ู','็','ำ','ึ','๊','๋๋'
      ]
      const frequencies = [3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
      ]
      const scores = [1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,5,5,5,5,5,5,1,1,1,1,1,2,2,2,2,2,3,3,3,3
      ]
      const rarities = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,1,1,1,1,1,2,2,2,2,2,3,3,3,3
      ]
      const types = ['V','A','A','A','AV','V','A','A','A','AV','A','A','A','A','A','A','A','V','A','A','A','V','V','A','A','V','A','V','A','A','A','A','A','A','A','A','A','A','A','A','A','A','A','T','T','V','V','V','V','V','S','V','S','V','V','T','T'
      ]

      const letterTile = letters.map((x,i) => {return{
        letter: letters[i],
        freq: frequencies[i],
        rarity: rarities[i],
        score: scores[i],
        type: types[i]
      }})
    }
  }
  return {GameDice, GameSpaceSpy, GameWordWar}
}
