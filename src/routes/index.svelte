<script>
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
</script>

<svelte:head>
	<title>Homepage</title>
</svelte:head>

<div>
   Welcome! Here is a collection of prototypes of board games I design. I make a digital version for easier playtesting during COVID-19 era.
</div>
{#each games as g}
      <a href={g.link}>
         <div class = 'game-info-block'>
            <h2>{g.title}</h2>
            <span>{g.numPlayers}  {g.time}</span>
            <div>
               {g.description}
            </div>
         </div>
      </a>
{/each}


<style>
a {text-decoration: none;}

.game-info-block{
   background-color: lightcyan;
   border: 2px solid black;
   border-radius: 3px;
   padding: 3px
}
</style>
