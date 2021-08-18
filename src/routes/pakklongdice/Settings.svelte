<script>
   import {gameConfigs} from '../../stores/game.js';
   console.log($gameConfigs.loaded)
   
   const DEFAULT_THEME = $gameConfigs.loaded? $gameConfigs.chosenTheme: 'space' 
   const DEFAULT_DIFFICULTY = 2
   const DEFAULT_GAMELENGTH = 3

   gameConfigs.set({
      chosenTheme: DEFAULT_THEME,
      shuffle: false,
      difficulty: DEFAULT_DIFFICULTY,
      gameLength: DEFAULT_GAMELENGTH
   })

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
   <select bind:value={$gameConfigs.chosenTheme}>
      {#each themes as theme}
         <option name="themes" selected={{theme} === DEFAULT_THEME}>{theme}</option>
      {/each}
   </select>
   <label>
      <input type="checkbox" bind:checked={$gameConfigs.shuffle}>
      Shuffle
   </label>
   <select bind:value={$gameConfigs.difficulty}>
      {#each difficulties as diff}
         <option value ={diff.value}>{diff.text} </option>
      {/each}
   </select>
   <select bind:value={$gameConfigs.gameLength}>
      {#each gameLengths as rl}
         <option value = {rl.value}>{rl.text}</option>
      {/each}
   </select>
</form>
