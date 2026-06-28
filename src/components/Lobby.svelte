<script>
   import { goto } from '$app/navigation';
   import {onMount} from 'svelte';
   import socket from '../stores/socket';
   import { selfInfo } from '../stores/self';
   
   export let title = ''
   export let slug = ''

   var rooms = []
   var onlinePlayers = []
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

   function refreshLobby(){
      loaded = false;
      socket.emit('get rooms', slug, (data)=>{
         rooms = data
         loaded = true;
      })
   }

   socket.on('update online players', (data)=>{
      onlinePlayers = data
   })

   socket.on('update rooms', (data)=>{
      // Normalize: data may be [[roomID, roomInfo], ...] or [roomInfo, ...] objects
      const normalized = data.map(entry => {
         if (Array.isArray(entry)) return entry; // already [roomID, roomInfo]
         return [entry.roomID, entry];            // plain object from lobby_update
      });
      rooms = normalized.filter(([, roomInfo]) => roomInfo.gameTitle === slug)
   })
</script>

<svelte:head>
   <title>{title}</title>
</svelte:head>

<div class="max-w-2xl mx-auto my-8 p-6 bg-base-100 rounded-3xl shadow-xl border border-base-200/50 winter-card-glow">
   <div class="flex flex-col items-center text-center gap-2 mb-6">
      <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
         {title}
      </h1>
      <p class="text-base-content/60 text-sm">Create a session or join an existing board game room</p>
   </div>



   <div class="flex justify-center mb-8">
      <button 
         class="btn btn-primary btn-lg shadow-md gap-2 hover:scale-105 transition-transform duration-200" 
         on:click={createRoom}
      >
         <span class="material-icons">add_circle_outline</span>
         Create a new room
      </button>
   </div>

   {#if !loaded}
      <div class="flex flex-col items-center gap-3 my-6">
         <span class="loading loading-ring loading-lg text-primary"></span>
         <span class="text-xs text-base-content/50 font-medium">Fetching active rooms...</span>
      </div>
   {/if}

   <div class="divider text-base-content/40 font-semibold uppercase tracking-wider text-xs flex items-center justify-between">
      <span>
         {#if rooms.length == 0}
            No active rooms
         {:else}
            Join an existing room
         {/if}
      </span>
      <button 
         class="btn btn-xs btn-ghost btn-circle text-base-content/40 hover:text-primary transition-all duration-200" 
         on:click={refreshLobby}
         title="Refresh rooms"
      >
         <span class="material-icons text-sm">refresh</span>
      </button>
   </div>

   {#if loaded && rooms.length == 0}
      <div class="flex flex-col items-center py-12 px-4 rounded-2xl bg-base-200/40 text-center gap-2">
         <span class="material-icons text-5xl text-base-content/20">sports_esports</span>
         <h3 class="font-bold text-lg text-base-content/70">No active rooms found</h3>
         <p class="text-sm text-base-content/50 max-w-sm">Be the first to start a game by clicking the "Create a new room" button above!</p>
      </div>
   {/if}

   <div class="grid gap-4 mt-6">
      {#each rooms as [roomID, roomInfo]}
         <div class="card card-side bg-base-200/50 hover:bg-base-200 border border-base-200 transition-all duration-200 shadow-sm hover:shadow-md">
            <div class="card-body p-5 flex-row items-center justify-between gap-4">
               <div>
                  <h3 class="font-bold text-lg text-base-content/80 flex items-center gap-2">
                     <span class="inline-block w-2.5 h-2.5 rounded-full bg-success animate-pulse"></span>
                     Room #{roomID}
                  </h3>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                     {#each roomInfo.players as p}
                        <div class="badge badge-sm badge-secondary badge-outline font-medium px-2.5 py-2">
                           <span class="material-icons text-xs mr-0.5">person</span>
                           {p}
                        </div>
                     {/each}
                  </div>
               </div>
               <div class="card-actions flex-none">
                  <button class="btn btn-secondary btn-md shadow-sm gap-1 hover:scale-105 transition-transform duration-200" on:click={()=>joinRoom(roomID)}>
                     <span>Join</span>
                     <span class="material-icons text-sm">arrow_forward</span>
                  </button>
               </div>
            </div>
         </div>
      {/each}
   </div>
</div>