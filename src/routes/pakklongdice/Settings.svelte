<script>
   import {gameConfigs} from '../../stores/game.js';
   import Select, { Option } from '@smui/select';
   import FormField from '@smui/form-field';
   import Checkbox from '@smui/checkbox';

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
      // {Value: 4, text: 'Chaos (4 colors, 12 dice)'}
   ]
   let gameLengths = [
      {value: 1, text: 'Practice (1 round)'},
      {value: 3, text: 'Warm-up (3 rounds)'},
      {value: 10, text: 'Full game! (10 rounds)'}
   ]

</script>

<form style='display: flex; flex-flow: row wrap'>
   <div class='select-field'>
      <Select variant="outlined" bind:value={$gameConfigs.chosenTheme} label="Theme">
         {#each themes as theme}
            <Option selected={{theme} === DEFAULT_THEME} value = {theme}>{theme}</Option>
         {/each}
      </Select>
   </div>
   <div class='select-field'>
      <Select variant="outlined" bind:value={$gameConfigs.difficulty} label="Dificulty">
         {#each difficulties as diff}
            <Option value ={diff.value}>{diff.text} </Option>
         {/each}
      </Select>
   </div>
   <div class='select-field'>
      <Select variant="outlined" bind:value={$gameConfigs.gameLength} label="Rounds">
         {#each gameLengths as rl}
            <Option value = {rl.value}>{rl.text}</Option>
         {/each}
      </Select>
   </div>
   <div class='select-field'>
      <FormField>
         <Checkbox bind:checked={$gameConfigs.shuffle}/>
         <span slot="label">Shuffle</span>
      </FormField>
   </div>
</form>

<style>
   .select-field{
      width:40%;
      margin: 3%
   }
</style>