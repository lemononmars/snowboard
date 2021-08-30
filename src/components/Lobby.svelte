<script>
   import {goto} from "@sapper/app";
   import {onMount} from 'svelte';
   import socket from '../stores/socket';
   import LinearProgress from '@smui/linear-progress';
   import Button, { Label } from '@smui/button';
   import Card, {Content,Actions,} from '@smui/card';
   
   export let title = ''
   export let slug = ''

   var rooms = []
   var loaded = false;
   // grab room list first
   onMount(()=>{
      socket.emit('get rooms', slug, (data)=>{
         rooms = data
         loaded = true;
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
      rooms = data
   })
</script>

<svelte:head>
   <title>{title}</title>
</svelte:head>

<div class = 'main'>
   <h1>{title}</h1>
   <Button variant="raised" class = 'create-button' on:click={createRoom}>
      <Label>Create a new room</Label>
   </Button>
   {#if !loaded}
      <LinearProgress indeterminate />
   {/if}
   {#if rooms.length == 0}
      <h2>No active room now...</h2>
   {:else}
      <h2>or join an existing room</h2>
   {/if}

   {#each rooms as [roomID, roomInfo]}
      <div class="card-container">
         <Card variant="outlined">
           <Content>
              Room #{roomID}
              {#each roomInfo.players as p}
                  <div>{p}</div>
               {/each}
            </Content>
           <Actions fullBleed>
             <Button on:click={()=>joinRoom(roomID)}>
               <Label>Join</Label>
               <i class="material-icons" aria-hidden="true">arrow_forward</i>
             </Button>
           </Actions>
         </Card>
       </div>
   {/each}
      
</div>

<style>
   .card-container{
      width: 100%
   }
</style>