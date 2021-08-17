<script>
   import Settings from './Settings.svelte';
   import {myUsername} from './stores.js'
   import { createEventDispatcher } from 'svelte';

   const dispatch = createEventDispatcher();

   function startGame(){
      dispatch('startGame', {});
   }
   let username = $myUsername
   export var action_text = 'Edit name'
</script>

<div id = "user-info">
   <input type="text" id="username" bind:value={username}/>
   <button id="action">{action_text}</button>
</div>
<div class = button-container>
   <Settings/>
   <button on:click={startGame}>
      Start a new game!
   </button>
</div>