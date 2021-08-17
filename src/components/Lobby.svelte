<script>
   import {goto} from "@sapper/app";
   import {onMount, afterUpdate} from 'svelte';
   import socket from '../stores/socket';

   export let title = ''
   export let slug = ''

   var rooms = []
   // grab room list first
   onMount(()=>{
      socket.emit('get rooms', slug, (data)=>{
         rooms = data
      })

      socket.emit('join lobby', slug)
   })
   
   function joinRoom(id){
      socket.emit('try joining room', id, (data)=>{
         if(data.available)
            goto(`./${slug}/${id}`)
         else
            alert(`unable to join because ${data.errorMessage}`)
      })
   }

   function createRoom(){
      socket.emit('create room', {
         public: true,
         gameTitle: slug,
         maxPlayers: 10
      }, (func) =>{
         goto(`./${slug}/${func}`)
      })
   }

   socket.on('update rooms', (data)=>{
      console.log(data)
      rooms = data
   })
</script>

<svelte:head>
   <title>{title}</title>
</svelte:head>

<div id = 'game-lobby'>
   This is the lobby for {title}. <br> 
   <button class = 'create-button' on:click={createRoom}>
      Create a new room
   </button><br>
   Or join an existing room<br>
   {#each rooms as [roomID, roomInfo]}
      <div class = 'room-block'>
         <div>Room #{roomID}</div>
         {#each roomInfo.players as p}
            <div>{p}</div>
         {/each}
      {#if roomInfo.public}
      <button class = 'join-button' on:click={()=>joinRoom(roomID)}>
         Join
      </button>
      {/if}
      </div>
   {/each}
      
</div>

<style>
.room-block{
   font-size: 20px;
   color: aquamarine;
   border: 2px solid black;
   padding: 2px
}

.join-button, .create-button{
   background-color: greenyellow;
   font-size:30px
}
</style>