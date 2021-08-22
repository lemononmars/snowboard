<script>
   import {goto} from "@sapper/app";
   import Button, { Label } from '@smui/button';
   import Card, {Content,Actions,} from '@smui/card';
   import Chip, { Set, LeadingIcon, Text} from '@smui/chips';

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
         title: 'Pakklong Talat - The Card Game',
         icon: 'pakkllongcard_icon.jpg',
         link: './pakklongcard',
         numPlayers: '2-4',
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

<div class = 'main'>
   <h1>Welcome!</h1> 
   <p>Choose a game to play</p>

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
            <Label>Find games</Label>
            <i class="material-icons" aria-hidden="true">arrow_forward</i>
            </Button>
         </Actions>
      </Card>
      </div>
   {/each}
</div>


<style>
.card-container{
   width: 100%
}
</style>