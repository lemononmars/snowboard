<svelte:head>
  <title>About - SNOWBOARD</title>
</svelte:head>

<div class="max-w-3xl mx-auto my-12 px-4">
  <div class="card bg-base-100 border border-base-200/50 shadow-xl winter-card-glow overflow-hidden">
    <!-- Header banner background -->
    <div class="h-32 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 flex items-center px-8 border-b border-base-200/40">
      <div>
        <h1 class="text-3xl font-extrabold text-base-content tracking-tight">About SNOWBOARD</h1>
        <p class="text-xs text-base-content/60 font-semibold uppercase tracking-wider mt-1">Project Information & History</p>
      </div>
    </div>

    <!-- Content body -->
    <div class="card-body p-8 gap-6 leading-relaxed">
      <p class="text-base-content/85 text-md font-medium">
        Welcome to <span class="text-primary font-bold">SNOWBOARD</span>, a digital playground for custom board game designs and playtest prototypes.
      </p>

      <p class="text-sm text-base-content/70">
        Originally conceived during the COVID-19 pandemic to facilitate remote playtesting and multiplayer fun, SNOWBOARD has evolved into a modern serverless P2P board game platform. It enables friends to play custom games together directly in their web browsers without needing complex setups or native installs.
      </p>

      <div class="divider my-2"></div>

      <!-- Feature cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex gap-3 items-start p-4 bg-base-200/40 rounded-2xl border border-base-200">
          <span class="p-2 bg-primary/10 text-primary rounded-xl">
            <span class="material-icons text-xl block">bolt</span>
          </span>
          <div>
            <h3 class="font-bold text-sm text-base-content/90">Real-Time Multiplayer</h3>
            <p class="text-xs text-base-content/60 mt-0.5">Powered by Supabase Realtime broadcast and presence channels for lag-free, serverless play.</p>
          </div>
        </div>

        <div class="flex gap-3 items-start p-4 bg-base-200/40 rounded-2xl border border-base-200">
          <span class="p-2 bg-secondary/10 text-secondary rounded-xl">
            <span class="material-icons text-xl block">palette</span>
          </span>
          <div>
            <h3 class="font-bold text-sm text-base-content/90">Premium Aesthetics</h3>
            <p class="text-xs text-base-content/60 mt-0.5">Sleek glassmorphism interfaces, smooth transitions, and responsive mobile-first layouts.</p>
          </div>
        </div>
      </div>

      <div class="card-actions justify-end border-t border-base-200/50 pt-6 mt-4">
        <a href="/" class="btn btn-primary gap-2 shadow-sm">
          <span class="material-icons text-sm">arrow_back</span>
          Back to Games
        </a>
      </div>
    </div>
  </div>
</div>