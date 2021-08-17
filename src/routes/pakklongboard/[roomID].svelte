<script context="module">
	var roomID
	// in case you join via the link
	// TODO: don't allow this. always redirect to home
	export async function preload({ params }) {
		socket.emit('join room', params.roomID, (data)=>{
			if(!data.available) {
				console.log('redirect')
				this.redirect(100, './pakklongdice')
			}
		})
		roomID = params.roomID
	}

   import {io} from 'socket.io-client'
	const socket = io('localhost:3000', {
		rejectUnauthorized: false,
      transports: ["websocket", 'polling'],
      autoConnect: false
   })
</script>

<script>
   import Waiting from './Waiting.svelte';
   import Playing from './Playing.svelte';
   import {chosenTheme, stateIndex, difficulty, gameLength, shuffle, myUsername} from './stores.js';

   var gameState = {
      gameTitle: 'pakklongdice',
      roomID: '',
      gameConfigs:{
         theme: '',
         difficulty: '',
         shuffle: '',
         gameLength: '',
         solo: true,
      },
      gameComponents:{
         dice: []
      },
      roundInfo: {
         round: 0,
         roundStartTime: 0,
         roundAnswer: -1,
      },
      playerInfo:{}
   }

   $: actionButtonImgUrl = [0,1,2,3].map(x => `./pakklongdice/img/${$chosenTheme}/${x+1}.png`)

   $: answerLists = [[],[],[],[]]
   $: action_text =['Edit name', 'Abort','Abort','Return to lobby'][$stateIndex]
   $: scoreBoard = []

   function updateScoreboard(data){
      var items = []
      for (var i in data.playerInfo.usernames)
         items.push([0, data.playerInfo.usernames[i], data.playerInfo.scores[i]])

      items.sort(function(first, second){
         return second[2] - first[2];
      });
   
      var rank = 1
      for (var i = 0; i < items.length; i ++) {
         if (i > 0 && items[i][2] != items[i-1][2])
            rank = i+1
         items[i][0] = rank
      }

      scoreBoard = items.map(x => {return{
         rank: x[0],
         username: x[1],
         score: x[2]
      }})
   } 
   // used with timer
   
   var timer = {
      interval: null,
      percentage:0,
      coolDownTime:0,
      roundTime:0,
      time:1,
      color: 'orangered'
   }
   $: timer.color = timer.color
   $: percentage_str = `${timer.percentage}%`
   function setTimer(time,color){
      clearInterval(timer.interval)
      timer.color = color
      var t = time // in second
      timer.interval = setInterval(function(){
         t = t - 0.01;
         if (t <= 0) {
            t=0;
            clearInterval(timer.interval);
         }
         timer.percentage = 100-((t/time)*100);
      }, 10);
   }
   $: users = {}

   var questionDice
   var chosenAnswer = -1

   var difficulty_str = ['easy', 'medium', 'hard'][$difficulty]
   var random_names = ['Rose', 'Orchid', 'Dandelion', 'Azalea', 'Jasmine', 'Lily', 'Acacia', 'Violet']

   var randomID = Math.floor(Math.random()*10000)
   var IDString = '0000'.slice(String(randomID).length) + String(randomID)
   myUsername.set(random_names[Math.floor(Math.random()*random_names.length)] + IDString)
   var myID

   socket.emit('add user', {'username': $myUsername})

   socket.on('update my id', (data)=>{
      myID = data
   })
   socket.on("users", (us) => {
      users = us
   });

   function emitUserDisconnect() {
		socket.emit('disconnect', myID); 
	}

   function startGame(){
      socket.emit('start game', {     
         difficulty: $difficulty,
         shuffle: $shuffle,
         gameLength: $gameLength,
         theme: $chosenTheme
      })
   }

   function submitAction(ans){
      if ($stateIndex != 2 || chosenAnswer != -1)
         return;
      
      chosenAnswer = ans
      stateIndex.set(1) // wait
      socket.emit('submit action',{
         userID: myID,
         username: $myUsername,
         action: ans
      })
   }

   socket.on('new game', function(data) {
      timer.coolDownTime = data.gameConfigs.solo? 2:5
      timer.roundTime = data.gameConfigs.difficulty == 3? 15:10
      chosenTheme.set(data.gameConfigs.theme)
      gameState = data
      updateScoreboard(data)
      stateIndex.set(1)
      socket.emit('update game state', data)
   });

   socket.on('new round', function(data) {
      answerLists = [[],[],[],[]]
      gameState = data
      questionDice = data.gameComponents.dice
      chosenAnswer = -1;
      socket.emit('update game state', data)
      stateIndex.set(1)

      // cool down and start
      setTimer(timer.coolDownTime, 'cyan')
      setTimeout(function(){
         stateIndex.set(2)
         setTimer(timer.roundTime, 'orangered')
      }, timer.coolDownTime * 1000)
   });

   socket.on('update answers', function(act) {
      answerLists[act.action].push(act.username)
   });

   socket.on('update client game state', function(data){
      // bounce gameState back from others to your own socket
      socket.emit('update game state', data)
   });
   
   socket.on('end round', function(data){
      setTimer(0, 'aquamarine')
      gameState = data
      updateScoreboard(data)

      socket.emit('update game state', data)
      socket.emit('clear round end timer')
   });

   socket.on('end game', function(data){
      setTimer(0, 'blue')
      stateIndex.set(3)
      gameState = data
      socket.emit('clear round end timer')
   });
</script>

<svelte:head>
   <title>Flower Dice Puzzle</title>
</svelte:head>

<svelte:window on:unload={emitUserDisconnect}/>

<div id = 'game-area'>
   {#if $stateIndex === 0 || $stateIndex === 3}
   <Waiting bind:action_text={action_text} on:startGame={startGame}/>
   {/if}

   {#if $stateIndex === 1 || $stateIndex === 2}
   <div class="timercontainer">
      <div class="progress_container" style="display:block">
         <div class="progress_bar" style="width:{percentage_str}; background-color:{timer.color}">
            &nbsp;
         </div>
      </div>
   </div>
   <br/>
   {/if}

   <div id = "action-zone">
      <table class = 'action-button-container'>
         <tr>
         {#each actionButtonImgUrl as url, i}
            <td>
               <button class = 'action-button' value = {i} on:click={()=>submitAction(i)}>
                  <img src={url}  alt = 'action button'/>
               </button>
            </td>
         {/each}
         </tr>
         <tr>
         {#each answerLists as lists}
            <td>
               {#each lists as ans}
               <div class = 'answered-players'>
                  {ans}
               </div>
               {/each}
            </td>
         {/each}
         </tr>
   </div>

   {#if $stateIndex === 1 || $stateIndex === 2}
      <Playing questionDice={questionDice}/>
   {/if}
</div>


{#if $stateIndex === 1 || $stateIndex === 2}
<div id = 'score-area'>
   <span>Round {gameState.roundInfo.round} / {gameState.gameConfigs.gameLength}</span><br>
   <span>Difficulty: {difficulty_str}, Shuffle: {gameState.gameConfigs.shuffle}</span>
   <table class = 'score-table'>
      <tr>
         <th> Rank </th>
         <th> Player </th>
         <th> Score </th>
      </tr>
      {#each scoreBoard as row}
         <tr>
            <td> {row.rank} </td>
            <td> {row.username} </td>
            <td> {row.score} </td>
         </tr>
      {/each}
   </table>
</div>
{/if}

<style>
/* mobile version*/
#game-area{
  transition: margin-left .5s;
  position:fixed;
  top:0;
  left:0;
  text-align: center;
  width: 100%;
  padding:5px;
}

#score-area{
  text-align: center;
}

.action-button-container button {
  margin: 2px; 
  padding: 2px;
 }
 
 #action-zone{
  width: auto; 
  text-align: center;
  margin-left: auto;
  margin-right: auto;
  height: 150px;
 }
 
 .action-button-container{
  display: inline-block;
  vertical-align: text-top;
  width: 20%;
  text-align: center;
 }

 .action-button-container img{
  width: 100%;
  height: auto
 }

.action-button {
  background-color: #BBBBBB;
  opacity: 60%;
  border: none;
  cursor: pointer;
  border-radius: 5px;
}

.action-button:hover {
  opacity: 30%;
}

.timercontainer { 
  text-align: center;
  display:block;
  width: 100%; 
  height:10px;
  margin:1px;
}
.progress_container { 
  width: 95%;
  background-color: grey;
  border:5px solid #222223; 
  display:none; 
  border-color:white
}
.progress_bar {
  background-color:orangered;
  width:0%; 
  height:100%; 
  border-right:2px solid #222223; 
  border-color:white
}

#score-area{
  text-align: center;
}

.score-table {
  border-bottom: 1px solid #ddd;
  text-align: center;
  padding: 10px;
  width: auto;
  font-size: 15px;
  margin-left: auto;
  margin-right: auto;
}

.score-table tr:hover {background-color: #f5f5f5;}
.score-table th{
  background-color: orange;
  color: white;
}

/* desktop version*/
@media only screen and (min-width: 1000px){
#game-area{
  text-align: center;
  width: 70%;
  margin: 10px;
  padding: 10px;
}

#score-area{
  text-align: center;
}

 #action-zone{
  width:100%; 
 }
 
 .action-button-container{
  display: inline-block;
  vertical-align: text-top;
  width: 120px;
  height: 200px;
  text-align: center;
 }

 .action-button-container img{
  height: 100px;
  width: 100px;
 }

.action-button {
  background-color: #BBBBBB;
  opacity: 60%;
  border: none;
  cursor: pointer;
  border-radius: 5px;
}

.action-button:hover {
  opacity: 30%;
}

.timercontainer { 
  display:block;
  width: 100%; 
  height:50px;
  margin:5px;
}
.progress_container { 
  background-color: grey;
  border:5px solid #222223; 
  display:none; 
  border-color:white
}
.progress_bar {
  background-color:orangered;
  width:0%; 
  height:40px; 
  border-right:2px solid #222223; 
  border-color:white
}

.score-table {
  border-bottom: 1px solid #ddd;
  text-align: center;
  padding: 10px;
  width: 100%;
  font-size: 20px;
}

.score-table tr:hover {background-color: #f5f5f5;}
.score-table th{
  background-color: orange;
  color: white;
}
}
   
.timercontainer { 
  display:block;
  width: 100%; 
  height:50px;
  margin:5px;
}
.progress_container { 
  background-color: grey;
  border:5px solid #222223; 
  display:none; 
  border-color:white
}
.progress_bar {
  background-color:orangered;
  width:0%; 
  height:40px; 
  border-right:2px solid #222223; 
  border-color:white
}
</style>