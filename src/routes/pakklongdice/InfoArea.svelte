<script>
   import { gameConfigs } from '../../stores/game.js';
   export var questionDice = []
   const color_list = ['#F6A9A9', '#FFBF86', '#C2F784', '#FFF47D']
   const border_style_list = ['solid', 'dotted', 'dashed', 'double']

   $: questionDiceImages = questionDice.map(x => {return {
                'url': `/pakklongdice/img/${$gameConfigs.chosenTheme}/${x.type+1}.png`,
                'color': color_list[x.color],
                'style': border_style_list[x.color]
             }});
</script>

<div class="flex flex-wrap justify-center gap-3 py-2 max-w-lg mx-auto">
   {#each questionDiceImages as qd}
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-[3px] shadow-sm transition-transform duration-200 hover:scale-105" 
           style="background-color: {qd.color}; border-style: {qd.style}; border-color: rgba(0, 0, 0, 0.2)">
         <img src={qd.url} class="w-full h-full p-1.5 object-contain select-none" alt="Dice Face">
      </div>
   {/each}
</div>

<style>
</style>
