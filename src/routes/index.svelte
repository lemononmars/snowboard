<script>
   import {goto} from "@sapper/app";
   import Button, { Label } from '@smui/button';
   import Card, {Content,Actions,} from '@smui/card';
   import Chip, { Set, LeadingIcon, Text} from '@smui/chips';

   let clicked = 0

   const games = [
      {
         title: 'Pakklong Dice',
         icon: 'pakkllongdice_icon.png',
         link: './pakklongdice',
         numPlayers: '1-10',
         time: '1-5',
         mechanics: ['Pattern recognition', 'Speed game'],
         description: `Bongo meets Set. Be the first one to see the pattern and solve the puzzle`
      },
      {
         title: 'Pakklong Talat',
         icon: 'pakkllongboard_icon.jpg',
         link: './pakklongboard',
         numPlayers: '2-5',
         time: '45-60',
         mechanics: ['Bidding', 'Simultaneous action selection', 'Set collection', 'Engine building'],
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
         <Set chips={[1]} let:chip nonInteractive>
         <Chip {chip}>
            <LeadingIcon class="material-icons">groups</LeadingIcon>
            <Text>{g.numPlayers}</Text>
         </Chip> 
         <Chip {chip}>
            <LeadingIcon class="material-icons">schedule</LeadingIcon>
            <Text>{g.time}</Text>
         </Chip>
         </Set>
         <Set chips={g.mechanics} let:chip nonInteractive>
            <Chip {chip}><Text>{chip}</Text></Chip>
         </Set>
            {g.description}
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