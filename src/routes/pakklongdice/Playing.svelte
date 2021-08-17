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

<div id = 'dice-zone-container'>
   {#each questionDiceImages as qd, i}
      <img src={qd.url} class = 'dice-img' style = 'background-color:{qd.color}; border-style:{qd.style}' alt = '{qd.color} and {qd.style}'>
      {#if i%3 == 2}<br>{/if}
   {/each}
</div>

<style>
#dice-zone-container{
  position: fixed;
  width: 100%;
  top: 40%;
  left: 50%;
  /* bring your own prefixes */
  transform: translate(-50%, -50%);
  text-align: center
}
.dice-img{
  height: 100px;
  width: 100px;
  border-radius: 2px;
}

@media only screen and (min-width: 720px){
#dice-zone-container{
   position: fixed;
   bottom: 0;
   right: 0;
   text-align: center
}

.dice-img{
  height: 150px;
  width: 150px;
  border-radius: 3px;
 }
}
</style>
   

