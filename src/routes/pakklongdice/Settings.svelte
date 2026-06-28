<script>
   import {gameConfigs} from '../../stores/game.js';

   let DEFAULT_THEME = 'space' 
   let DEFAULT_DIFFICULTY = 2
   let DEFAULT_GAMELENGTH = 3
   let DEFAULT_SHUFFLE = false

   if ($gameConfigs.loaded) {
      DEFAULT_THEME = $gameConfigs.chosenTheme
      DEFAULT_DIFFICULTY = $gameConfigs.difficulty
      DEFAULT_GAMELENGTH = $gameConfigs.gameLength
      DEFAULT_SHUFFLE = $gameConfigs.shuffle
   }

   gameConfigs.set({
      chosenTheme: DEFAULT_THEME,
      shuffle: DEFAULT_SHUFFLE,
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
   ]
   let gameLengths = [
      {value: 1, text: 'Practice (1 round)'},
      {value: 3, text: 'Warm-up (3 rounds)'},
      {value: 10, text: 'Full game! (10 rounds)'}
   ]
</script>

<form class="flex flex-wrap md:flex-nowrap items-end gap-4 w-full p-4 bg-base-200/50 rounded-2xl border border-base-300/40">
   <div class="form-control flex-grow md:w-auto">
      <label class="label font-semibold text-base-content/75 pb-1" for="theme-select">
         <span class="label-text flex items-center gap-1">
            <span class="material-icons text-sm">palette</span>
            Theme
         </span>
      </label>
      <select id="theme-select" class="select select-bordered w-full font-medium focus:select-primary transition-all duration-200" bind:value={$gameConfigs.chosenTheme}>
         {#each themes as theme}
            <option value={theme}>{theme}</option>
         {/each}
      </select>
   </div>

   <div class="form-control flex-grow md:w-auto">
      <label class="label font-semibold text-base-content/75 pb-1" for="difficulty-select">
         <span class="label-text flex items-center gap-1">
            <span class="material-icons text-sm">trending_up</span>
            Difficulty
         </span>
      </label>
      <select id="difficulty-select" class="select select-bordered w-full font-medium focus:select-primary transition-all duration-200" bind:value={$gameConfigs.difficulty}>
         {#each difficulties as diff}
            <option value={diff.value}>{diff.text}</option>
         {/each}
      </select>
   </div>

   <div class="form-control flex-grow md:w-auto">
      <label class="label font-semibold text-base-content/75 pb-1" for="rounds-select">
         <span class="label-text flex items-center gap-1">
            <span class="material-icons text-sm">loop</span>
            Rounds
         </span>
      </label>
      <select id="rounds-select" class="select select-bordered w-full font-medium focus:select-primary transition-all duration-200" bind:value={$gameConfigs.gameLength}>
         {#each gameLengths as rl}
            <option value={rl.value}>{rl.text}</option>
         {/each}
      </select>
   </div>

   <div class="form-control flex-shrink-0">
      <div class="tooltip tooltip-top" data-tip="Shuffle Dice positions">
         <label 
            class="btn flex items-center justify-center h-12 min-h-12 w-12 rounded-xl cursor-pointer transition-all duration-200
              {$gameConfigs.shuffle 
                ? 'btn-primary shadow-md' 
                : 'btn-outline border-base-300 bg-base-100 hover:bg-base-200 text-base-content/70'}"
            for="shuffle-checkbox"
         >
            <span class="material-icons">shuffle</span>
            <input id="shuffle-checkbox" type="checkbox" class="hidden" bind:checked={$gameConfigs.shuffle} />
         </label>
      </div>
   </div>
</form>