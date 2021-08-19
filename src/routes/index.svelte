<script>
   import {goto} from "@sapper/app";
   import Button, { Label } from '@smui/button';
   import Card, {
    Content,
    Actions,
  } from '@smui/card';

   let clicked = 0

   const games = [
      {
         title: 'Pakklong Dice',
         icon: 'pakkllongdice_icon.png',
         link: './pakklongdice',
         numPlayers: '2-10 players',
         time: '3-10 minutes',
         description: `Bongo meets Set. Be the first one to see the pattern and solve the puzzle`
      },
      {
         title: 'Pakklong Talat',
         icon: 'pakkllongboard_icon.jpg',
         link: './pakklongboard',
         numPlayers: '2-5 players',
         time: '45-60 minutes',
         description: `Be the best bouquet maker! Grab flowers, upgrade your shop, and gain bonuses`
      }
   ]

   function joinLobby(link){
      goto(link)
   }
</script>

<svelte:head>
	<title>Homepage</title>
</svelte:head>

<div>
   Welcome! Here is a collection of prototypes of board games I design. I make a digital version for easier playtesting during COVID-19 era.
</div>
{#each games as g}
<div class="card-container">
   <Card>
      <Content>
         <h2>{g.title}</h2>
         <span>{g.numPlayers}  {g.time}</span>
         <div>
            {g.description}
         </div>
      </Content>
      <Actions fullBleed>
         <Button on:click={()=>joinLobby(g.link)}>
         <Label>Join lobby</Label>
         <i class="material-icons" aria-hidden="true">arrow_forward</i>
         </Button>
      </Actions>
   </Card>
   </div>
{/each}


<style>
</style>