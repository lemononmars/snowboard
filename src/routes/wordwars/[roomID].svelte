<script>
   import {goto} from '@sapper/app';

   // game related imports
   import {onMount} from 'svelte';
   import {gameInfo, gameConfigs, stateIndex} from '../../stores/game';
   import {selfInfo} from '../../stores/self'
   import socket from '../../stores/socket';

   // material UI imports
   import Button, { Group, Label } from '@smui/button';
   import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
   import LinearProgress from '@smui/linear-progress'; // to replace time container
   
   // import all these just to get the ID...
   import { stores } from "@sapper/app";
   const { page } = stores();
   const { params } = $page;
   const { roomID } = params;

   const GAME_STATUS_PREGAME = 0
   const GAME_STATUS_WAITING = 1
   const GAME_STATUS_PLAYING = 2
   const GAME_STATUS_GAMEEND = 3
   var users = {}

   onMount(() =>{
      selfInfo.useLocalStorage()
      users[$selfInfo.userID] = $selfInfo.username
      socket.emit('join room', roomID, func=>{
         if (!func.successful)
            goto('/pakklongdice?error=noroomID') // redirect to lobby if room is unavaible
         else {
            $selfInfo.roomID = roomID
         }
      })
   })

   stateIndex.set(GAME_STATUS_PREGAME)
   $: actionButtonImgUrl = [0,1,2,3].map(x => `./pakklongdice/img/${$gameConfigs.chosenTheme}/${x+1}.png`)
   $: answerLists = updateActionList(actionList)
   $: scoreBoard = updateScoreboard($gameInfo.playerInfo)
   var actionStatus = new Array(4).fill(0) // 0 = not chosen, 1 = chosen, 2 = correct
   const actionButtonColors = ['grey', 'blue', 'green']

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
      actionStatus = new Array(4).fill(0)
      socket.emit('start game', $gameConfigs)
   }
   
   socket.on('add player', (data) => {
      users[data.userID] = data.username
      // add dummy scores while waiting for the game to start
      $gameInfo.playerInfo.usernames[data.userID] = data.username
      $gameInfo.playerInfo.scores[data.userID] = 0
   })

   socket.on('remove player', (data) => {
      if (data.userID in users) {
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
      actionStatus = new Array(4).fill(0)
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
         actionStatus = new Array(4).fill(0)
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

   function abort(){
      socket.emit('abort'); 
      clearInterface()
   }

   function restart(){
      $stateIndex = GAME_STATUS_PREGAME
      clearInterface()
   }

   function returnToLobby(){
      socket.emit('leave room', roomID); 
      goto('/pakklongdice');
   }

   function clearInterface(){
      actionStatus = new Array(4).fill(0)
      actionList = []
      clearInterval(timer.interval)
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

<svelte:window on:unload={emitUserDisconnect}/> <!--TODO: let user reconnect-->

<div id = 'game-area'>
      <Group>
         {#if $stateIndex === GAME_STATUS_PREGAME}
            <Button on:click={() => startGame()}><Label>Start Game!</Label></Button>
         {/if}
         {#if $stateIndex === GAME_STATUS_GAMEEND}
            <Button on:click={() => restart()}><Label>Restart</Label></Button>
         {/if}
         {#if $stateIndex === GAME_STATUS_WAITING || $stateIndex === GAME_STATUS_PLAYING}
            <Button on:click={() => abort()}><Label>Abort</Label></Button>
         {/if}
         {#if $stateIndex === GAME_STATUS_PREGAME || $stateIndex == GAME_STATUS_GAMEEND}
            <Button on:click={() => returnToLobby()}><Label>Return to lobby</Label></Button>
         {/if}
       </Group>

   {#if $stateIndex === 0}
      <div class = button-container>
         <Settings/>
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

   {#if window}
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
   {/if}

   {#if $stateIndex != GAME_STATUS_PREGAME}
      <InfoArea {questionDice}/>
   {/if}
</div>


<div id = 'score-area'>
   {#if $stateIndex != 0}
      <span>Round {$gameInfo.roundInfo.round} / {$gameInfo.gameConfigs.gameLength}</span><br>
      <span>Difficulty: {difficulty_str}, Shuffle: {$gameInfo.gameConfigs.shuffle}</span>
   {/if}
   <DataTable table$aria-label="User list" style="width: 100%;">
      <Head>
         <Row>
            <Cell numeric> Rank </Cell>
            <Cell style="width: 100%;"> Player </Cell>
            <Cell numeric> Score </Cell>
         </Row>
      </Head>
      <Body>
      {#each scoreBoard as row}
         <Row>
            <Cell> {row.rank} </Cell>
            <Cell> {#if row.username === $selfInfo.username} (You) {/if} {row.username} </Cell>
            <Cell> {row.score} </Cell>
         </Row>
      {/each}
      </Body>
   </DataTable>
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
  height: 10%;
  overflow: auto;
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