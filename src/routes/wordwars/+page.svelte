<script>
   import Lobby from '../../components/Lobby.svelte'
   
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
   <title>Word Wars - Soon</title>
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Niramit:wght@200;600&display=swap" rel="stylesheet">
</svelte:head>

<div class="max-w-4xl mx-auto my-12 px-4 flex flex-col items-center">
   <div class="text-center mb-8 flex flex-col gap-2">
      <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Word Wars</h1>
      <h2 class="text-lg text-base-content/60 font-medium">Coming soon! Meanwhile, enjoy pressing these letter tiles.</h2>
   </div>

   <!-- Click Counter -->
   <div class="stats shadow-md mb-8 border border-base-200 bg-base-100">
      <div class="stat px-8 py-4 text-center">
         <div class="stat-title font-semibold uppercase tracking-wider text-xs text-base-content/50">Total Clicks</div>
         <div class="stat-value text-primary text-4xl">{clicked}</div>
         <div class="stat-desc text-xs text-base-content/40 mt-1">Keep clicking to heat up the winter!</div>
      </div>
   </div>

   <!-- Letter Tiles Grid -->
   <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 w-full bg-base-100 p-6 rounded-3xl border border-base-200/50 shadow-xl winter-card-glow">
      {#each cards as card}
         <button 
            on:click={() => clicked++}
            class="group relative flex flex-col items-center justify-between p-3 h-24 bg-base-200/50 hover:bg-primary hover:text-primary-content border border-base-200 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer font-['Niramit']"
         >
            <!-- Letter -->
            <span class="text-2xl font-bold mt-1 text-base-content group-hover:text-primary-content">{card.letter}</span>
            
            <!-- Score Badge -->
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-base-300 text-base-content/75 group-hover:bg-primary-content/25 group-hover:text-primary-content">
               {card.score}
            </span>
         </button>
      {/each}
   </div>
</div>