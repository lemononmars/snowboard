<script>
   import InfoArea from './InfoArea.svelte';
   import Settings from './Settings.svelte';
   import {onMount} from 'svelte';
   import {goto} from '@sapper/app';
   import {gameInfo, gameConfigs, stateIndex} from '../../stores/game.js';
   import {selfInfo} from '../../stores/'
   import socket from '../../stores/socket';
   // import Button from '@smui/button'; // doesn't work, sadly
   
   // import all these just to get the ID
   import { stores } from "@sapper/app";
   const { page } = stores();
   const { params } = $page;
   const { roomID } = params;

   const GAME_STATUS_PREGAME = 0
   const GAME_STATUS_WAITING = 1
   const GAME_STATUS_PLAYING = 2
   const GAME_STATUS_GAMEEND = 3

   onMount(() =>{
      socket.emit('join room', roomID, func=>{
         if (!func.successful)
            goto('/pakklongdice?error=noroomID') // redirect to lobby if room is unavaible
         else
            socket.data.roomID = roomID
      })
   })

   stateIndex.set(GAME_STATUS_PREGAME)
   $: actionButtonImgUrl = [0,1,2,3].map(x => `./pakklongdice/img/${$gameConfigs.chosenTheme}/${x+1}.png`)
   $: action_text =['Edit name', 'Abort','Abort','Return to lobby'][$stateIndex]
   $: answerLists = updateActionList(actionList)
   $: scoreBoard = updateScoreboard($gameInfo.playerInfo)
   var actionStatus = [0,0,0,0] // 0 = not chosen, 1 = chosen, 2 = correct
   const actionButtonColors = ['grey', 'blue', 'green']
   var users = {}

   // TODO : put this in preload or afterupdate?
   //if(socket.data != null) {
      users[$selfInfo.userID] = $selfInfo.username
   //}

   var questionDice
   gameInfo.set({
      roundInfo: {round: 0},
      playerInfo: {usernames:{}, scores:{}, actions:{}}
   })
   var actionList = {}
   var chosenAnswer = -1
   var difficulty_str = ['easy', 'medium', 'hard'][$gameConfigs.difficulty]
   
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

   /*
   socket interactions with room
   */

   function emitUserDisconnect() {
		socket.emit('disconnect', myID);
   }

   function startGame(){
      socket.emit('start game', $gameConfigs)
   }
   
   socket.on('add player', (data) => {
      users[data.userID] = data.username
      // add dummy scores while waiting for the game to start
      $gameInfo.playerInfo.usernames[data.userID] = data.username
      $gameInfo.playerInfo.scores[data.userID] = 0
   })

   socket.on('remove player', (data) => {
      if (data.userID in playerInfo) {
         delete $gameInfo.playerInfo.usernames[data.userID]
      }
   })

   /*
      socket interactions with game
   */

   function submitAction(ans){
      if ($stateIndex != GAME_STATUS_PLAYING || chosenAnswer != -1)
         return;
      
      chosenAnswer = ans
      actionStatus[ans] = 1
      stateIndex.set(GAME_STATUS_WAITING) // wait
      socket.emit('submit action', {    // emit to game
         action: ans,
         roundScore: 0,
         time: 0
      })
   }

   socket.on('new game', function(data) {
      timer.coolDownTime = data.gameConfigs.solo? 2:5
      timer.roundTime = data.gameConfigs.difficulty == 3? 15:10
      $gameConfigs.chosenTheme = data.gameConfigs.chosenTheme // update theme in case another player changes it
      $gameInfo = data
      questionDice = []
      actionStatus = [0,0,0,0]
      actionList = {}
      stateIndex.set(GAME_STATUS_WAITING)
   });

   socket.on('new round', function(data) {
      $gameInfo = data
      chosenAnswer = -1;
      stateIndex.set(GAME_STATUS_WAITING)

      // cool down and start
      setTimer(timer.coolDownTime, 'cyan')
      setTimeout(function(){
         // reveal dice and reset round score once countdown is completed
         questionDice = data.gameComponents.dice
         actionList = {}
         actionStatus = [0,0,0,0]
         stateIndex.set(GAME_STATUS_PLAYING)
         setTimer(timer.roundTime, 'orangered')
      }, timer.coolDownTime * 1000)
   });

   socket.on('update answers', function(act) {
      actionList[act.userID] = act.action
   });
   
   socket.on('end round', function(data){
      setTimer(0, 'aquamarine')
      $gameInfo = data
      actionStatus[data.roundInfo.roundAnswer] = 2
      actionList = data.playerInfo.actions
   });

   socket.on('end game', function(data){
      setTimer(0, 'blue')
      stateIndex.set(GAME_STATUS_GAMEEND)
      $gameInfo = data
   });

   /*
      helper functions
   */

   function gameStateButton(){
      switch($stateIndex){
         case GAME_STATUS_PREGAME: socket.emit('edit name', $selfInfo.username); break;
         case GAME_STATUS_PLAYING:
         case GAME_STATUS_WAITING: socket.emit('abort'); clearInterval(timer.interval); break;
         case GAME_STATUS_GAMEEND: goto('/pakklongdice'); break;
         default: 
      }
   }

   function updateScoreboard(pinfo){
      var items = []
      for (var id in pinfo.usernames)
         items.push([0, pinfo.usernames[id], pinfo.scores[id]])

      items.sort(function(first, second){
         return second[2] - first[2];
      });
   
      var rank = 1
      for (var i = 0; i < items.length; i ++) {
         if (i > 0 && items[i][2] != items[i-1][2])
            rank = i+1
         items[i][0] = rank
      }

      return items.map(x => {return{
         rank: x[0],
         username: x[1],
         score: x[2]
      }})
   } 

   function updateActionList(actionList){
      var al = [[],[],[],[]]
      for(const id in actionList)
         al[actionList[id].action].push(
            [$gameInfo.playerInfo.usernames[id], actionList[id].roundScore] // plus time for debugging?
         )
      return al
   }

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
</script>

<svelte:head>
   <title>Flower Dice Puzzle</title>
</svelte:head>

<svelte:window on:unload={emitUserDisconnect}/>

<div id = 'game-area'>
   <div id = "user-info">
      <input type="text" id="username" bind:value={$selfInfo.username}/>
      <button on:click={gameStateButton}>{action_text}</button>
   </div>
   {#if $stateIndex === 0 || $stateIndex === 3}
      <div class = button-container>
         <Settings/>
         <button class = 'start-game-button' on:click={startGame}>
            Start a new game!
         </button>
      </div>
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
      <table class = 'action-button-table'>
         <tr>
         {#each actionButtonImgUrl as url, i}
            <td>
               <button class = 'action-button' style='background-color: {actionButtonColors[actionStatus[i]]}' value = {i} on:click={()=>submitAction(i)}>
                  <img src={url}  alt = 'action button'/>
               </button>
            </td>
         {/each}
         </tr>
         <tr>
         {#each answerLists as lists}
            <td class = 'answered-players'>
               {#each lists as [name,score]}
               <div>
                  {name} {#if $stateIndex != GAME_STATUS_PLAYING} :{score} {/if}
               </div>
               {/each}
            </td>
         {/each}
         </tr>
   </div>

   {#if $stateIndex != GAME_STATUS_PREGAME}
      <InfoArea {questionDice}/>
   {/if}
</div>


<div id = 'score-area'>
   {#if $stateIndex != 0}
      <span>Round {$gameInfo.roundInfo.round} / {$gameInfo.gameConfigs.gameLength}</span><br>
      <span>Difficulty: {difficulty_str}, Shuffle: {$gameInfo.gameConfigs.shuffle}</span>
   {/if}
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

<style>
/* mobile version*/
#game-area{
  position:fixed;
  bottom:5%;
  text-align: center;
  width: auto;
  margin:5px;
}

#score-area{
  text-align: center;
  position:fixed;
  top:0;
  width: 100%;
}
 
 #action-zone{
  width: auto; 
  text-align: center;
  margin-left: auto;
  margin-right: auto;
  height: 150px;
 }
 
 .action-button-table{
   table-layout: auto;
  display: inline-block;
  vertical-align: text-top;
  width: 100%;
  text-align: center;
 }

 .action-button-table button {margin: 2px; }
 .action-button-table td{width: 25%;}
 .action-button-table img{
  width: 100%;
  height: auto
 }

.action-button {
  background-color: #BBBBBB;
  opacity: 60%;
  width: 100%;
  border: none;
  cursor: pointer;
  border-radius: 5px;
}

.action-button:hover {
  opacity: 30%;
}

.answered-players{
   font-size: 12px;
   word-wrap: break-word
}

.start-game-button{
   font-size: 20px;
   background-color: lightskyblue
}

.timercontainer { 
  text-align: center;
  display:block;
  width: 100%; 
  height:10px;
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
@media only screen and (min-width: 720px){
#game-area{
  text-align: center;
  position:fixed;
  top:0;
  left:0;
  width: 50%;
  margin: 10px;
  padding: 10px;
}

#score-area{
  text-align: center;
  position:fixed;
  top:0;
  right:0;
  width: 50%
}

 #action-zone{
  width:100%; 
  margin-left: auto;
  margin-right: auto;
  width: auto; 
  text-align: center;
 }
 
 .action-button-table{
   table-layout: auto;
  display: inline-block;
  vertical-align: text-top;
  width: 100%;
  text-align: center;
 }

 .action-button-table button {
  margin: 2px; 
 }

 .action-button-table td{
    width: 25%;
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