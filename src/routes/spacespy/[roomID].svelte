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
   import Card, {Content,
    Media,
    MediaContent,
    Actions,
    ActionButtons,
  } from '@smui/card';
   
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
   var roomNames = ['Oxygen', 'Fuel', 'Energy', 'Planning', 'Operation']
   var roomDescriptions = ['','','','','']
   var actionRooms = [0,1,2,3,4].map(n => {
      return {
         id: n,
         title: roomNames[n],
         description: roomDescriptions[n],
         players: [],
         chips: []
      }
   })

   onMount(() =>{
      selfInfo.useLocalStorage()
      users[$selfInfo.userID] = $selfInfo.username
      socket.emit('join room', roomID, func=>{
         if (!func.successful)
            goto('/spacespy?error=noroomID') // redirect to lobby if room is unavaible
         else {
            $selfInfo.roomID = roomID
         }
      })
   })

   stateIndex.set(GAME_STATUS_PREGAME)
   
   gameInfo.set({
      roundInfo: {round: 0},
      playerInfo: {usernames:{}, roles:{}, chips:{}, scores:{}, actions:{}}
   })
   var actionList = {}
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
   })

   socket.on('remove player', (data) => {
      if (data.userID in users) {
         delete $gameInfo.playerInfo.usernames[data.userID]
      }
   })

   /*
      socket interactions with game
   */

   function enterRoom(id) {
      socket.emit('join action room', {actionRoomID: id, player: $selfInfo.userID})
   }

   function submitActions(ans){
      if ($stateIndex != GAME_STATUS_PLAYING || chosenAnswer != -1)
         return;
      
      socket.emit('submit action', {    // emit to game
         action: ans,
         roundScore: 0,
         time: 0
      })
   }

   socket.on('new game', function(data) {
      $gameInfo = data
      stateIndex.set(GAME_STATUS_WAITING)
   });

   socket.on('new round', function(data) {
      $gameInfo = data
      stateIndex.set(GAME_STATUS_WAITING)

      // cool down and start
      setTimer(timer.coolDownTime, 'cyan')
   });

   socket.on('update answers', function(act) {
      actionList[act.userID] = act.action
   });
   
   socket.on('end round', function(data){
      setTimer(0, 'aquamarine')
      $gameInfo = data
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
      goto('/spacespy');
   }

   function clearInterface(){
      clearInterval(timer.interval)
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
   <title>Space Spy</title>
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

   {#if $stateIndex === 1 || $stateIndex === 2}
      <LinearProgress/>
   {/if}

   {#if $stateIndex === GAME_STATUS_PREGAME}
   {#each actionRooms as room}
   <div class="card-container">
      <Card>
          <Media class="room-image">

          </Media>

          <Content class="mdc-typography--body2">
            {room.title}
            {#each room.players as p}
               {p.username}
            {/each}
          </Content>

        <Actions>
          <ActionButtons>
            <Button on:click={() => enterRoom(room.id)}>
              <Label>Enter</Label>
            </Button>
          </ActionButtons>
        </Actions>
      </Card>
    </div>
    {/each}
   {/if}
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
}
</style>