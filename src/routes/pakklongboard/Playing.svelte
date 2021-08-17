<script>
   import { chosenTheme } from './stores.js';
   export var questionDice = []
   const color_list = ['#F6A9A9', '#FFBF86', '#C2F784', '#FFF47D']
   const border_style_list = ['solid', 'dotted', 'dashed', 'double']

   $: questionDiceImages = questionDice.map(x => {return {
               'url': `./pakklongdice/img/${$chosenTheme}/${x.type+1}.png`,
               'color': color_list[x.color],
               'style': border_style_list[x.color]
            }});

</script>

<div id = 'dice-zone'>
   {#each questionDiceImages as qd}
      <img src={qd.url} class = 'dice-img' style = 'background-color:{qd.color}; border-style:{qd.style}' alt = '{qd.color} and {qd.style}'>
   {/each}
</div>

<style>
.dice-img{
  height: 80px;
  width: 80px;
  border-radius: 2px;
}

@media only screen and (min-width: 1000px){
 .dice-img{
  height: 100px;
  width: 100px;
  border-radius: 3px;
 }
}
</style>
   

