<script>
   import { chosenTheme, difficulty, gameLength, shuffle } from './stores.js';
/*    let chosenTheme_val, difficulty_val, gameLength_val, shuffle_val
   $: chosenTheme.set(chosenTheme_val)
   $: difficulty.set(difficulty_val)
   $: gameLength.set(gameLength_val)
   $: shuffle.set(shuffle_val) */
   
   let themes = [
      'flower','space','fruit','animal','suit','element','snow'
   ]

   let difficulties = [
      {value: 1, text: 'Easy (1 color, 3 dice)'}, 
      {value: 2, text: 'Medium (2 colors, 5 dice)'},
      {value: 3, text: 'Hard (3 colors, 9 dice)'},
      // {Value: 4, text: 'Chaos (4 colors, 12 dice)'}
   ]
   let gameLengths = [
      {value: 1, text: 'One-shot (1 round)'},
      {value: 3, text: 'Warm-up (3 rounds)'},
      {value: 10, text: 'Full game! (10 rounds)'}
   ]

</script>

<form>
   <select bind:value={$chosenTheme}>
      {#each themes as theme}
         <option name="themes" value={theme}>
            {theme}
         </option>
      {/each}
   </select>
   <label>
      <input type="checkbox" bind:checked={$shuffle}>
      Shuffle
   </label>
   <select bind:value={$difficulty}>
      {#each difficulties as diff}
         <option value ={diff.value}>
            {diff.text} 
         </option>
      {/each}
   </select>
   <select bind:value={$gameLength}>
      {#each gameLengths as rl}
         <option value = {rl.value}>
            {rl.text}
         </option>
      {/each}
   </select>
</form>
