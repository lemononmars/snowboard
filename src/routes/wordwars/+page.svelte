<script>
   import Lobby from '../../components/Lobby.svelte'
   import Card, {PrimaryAction,Actions} from '@smui/card';
   
   const gameInfo = {
      title: 'Word Wars',
      slug: 'wordwars'
   }

   let clicked = 0

   const letters = ['า','ร','น','ก','อ','เ','ง','ม','ย','ว','ท','ด','ล','ต','ห','ส','บ','ะ','ค','ป','จ','แ','ไ','พ','ข','ใ','ช','โ','ธ','ผ','ศ','ถ','ณ','ซ','ษ','ญ','ภ','ฐฑฒ','ฟฝ','ฉฌฆ','ฤฦ','ฎฏ','ฮฬ','่','้','ั','ิ','ี','ุ','ื','์','ู','็','ำ','ึ','๊','๋๋']
   const scores = [1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,5,5,5,5,5,5,1,1,1,1,1,2,2,2,2,2,3,3,3,3]
   const cards = scores.map((x,i) => {return{letter:letters[i], score:scores[i]}})
</script>

<svelte:head>
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Niramit:wght@200;600&display=swap" rel="stylesheet">
</svelte:head>

<div class = 'main'>
   <h1>Soon...</h1>
   <h2>Meanwhile, enjoy pressing this idle buttons</h2>
   <div class ='button-container'>
   {#each cards as card}
      <div class="card-container">
         <Card style="width:100%">
         <PrimaryAction on:click={() => clicked++} padded>
            {card.letter}
         </PrimaryAction>
         <Actions>
            {card.score}
         </Actions>
         </Card>
      </div>
   {/each}
   </div>
</div>


<!-- <Lobby {...gameInfo}/> -->

<style>
   .button-container{
      display: flex;
      flex-flow: row wrap;
   }

   .card-container{
      font-family: 'Niramit', sans-serif;
      font-size: 20px;
   }
</style>