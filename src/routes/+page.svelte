<script>
  import { goto } from "$app/navigation";

  const games = [
    {
      title: "Pakklong Dice",
      icon: "pakkllongdice_icon.png",
      link: "./pakklongdice",
      numPlayers: "1-10",
      time: "1-5 min",
      mechanics: ["Pattern recognition", "Speed game"],
      description: `Bongo meets Set. Be the first one to see the pattern and solve the puzzle.`,
    },
    {
      title: "Pakklong Talat - The Card Game",
      icon: "pakkllongcard_icon.jpg",
      link: "./pakklongcard",
      numPlayers: "2-4",
      time: "45-60 min",
      mechanics: [
        "Bidding",
        "Simultaneous action selection",
        "Set collection",
        "Engine building",
      ],
      description: `Be the best bouquet maker! Grab flowers, upgrade your shop, and gain bonuses.`,
    },
    {
      title: "Pakklong Talat - The Board Game",
      icon: "pakkllongcard_icon.jpg",
      link: "./pakklongboard",
      numPlayers: "2-6",
      time: "60-90 min",
      mechanics: [
        "Grid movement",
        "Action selection",
        "Set collection",
        "Multiplayer",
      ],
      description: `Multiplayer online board game of Pak Klong Talat.`,
    },
    {
      title: "Space Spy",
      icon: "spacespy_icon.jpg",
      link: "./spacespy",
      numPlayers: "5-10",
      time: "20-30 min",
      mechanics: ["Hidden role", "Traitor", "Set collection"],
      description: `Complete missions as astronauts, but beware the uncovered spies!`,
    },
    {
      title: "Word Wars",
      icon: "wordwar_icon.jpg",
      link: "./wordwars",
      numPlayers: "2-8",
      time: "10-30 min",
      mechanics: ["Word", "Speed", "Set collection"],
      description: `Can you find the best word?`,
    },
  ];

  function joinLobby(link) {
    if (link.endsWith(".html") || link.startsWith("/p/")) {
      window.location.href = link;
    } else {
      goto(link);
    }
  }
</script>

<svelte:head>
  <title>Homepage - SNOWBOARD</title>
</svelte:head>

<div class="max-w-5xl mx-auto my-12 px-4">
  <div class="text-center mb-12 flex flex-col gap-3">
    <h1
      class="text-5xl font-black tracking-tight text-base-content md:text-6xl"
    >
      Welcome to <span
        class="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"
        >SNOWBOARD</span
      >
    </h1>
    <p
      class="text-base-content/60 text-lg md:text-xl font-medium max-w-xl mx-auto"
    >
      A premium digital collection of custom board games and playtest
      prototypes.
    </p>
    <div class="w-24 h-1.5 bg-primary/20 rounded-full mx-auto mt-2"></div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
    {#each games as g}
      <div
        class="card bg-base-100 border border-base-200/60 shadow-lg hover:shadow-xl transition-all duration-300 winter-card-hover flex flex-col h-full overflow-hidden"
      >
        <div
          class="card-body p-6 flex flex-col justify-between flex-grow gap-6"
        >
          <div class="flex flex-col gap-4">
            <div class="flex items-start justify-between gap-4">
              <h2
                class="card-title text-2xl font-bold text-base-content/90 tracking-tight leading-tight"
              >
                {g.title}
              </h2>
              <span class="p-2 bg-primary/10 text-primary rounded-xl">
                <span class="material-icons block text-xl">sports_esports</span>
              </span>
            </div>

            <!-- Quick Stats Badges -->
            <div class="flex flex-wrap gap-2">
              <div
                class="badge badge-primary badge-outline font-semibold gap-1 px-3 py-3"
              >
                <span class="material-icons text-sm">groups</span>
                <span>{g.numPlayers} Players</span>
              </div>
              <div
                class="badge badge-secondary badge-outline font-semibold gap-1 px-3 py-3"
              >
                <span class="material-icons text-sm">schedule</span>
                <span>{g.time}</span>
              </div>
            </div>

            <p class="text-base-content/70 leading-relaxed text-sm my-1">
              {g.description}
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <!-- Mechanics Chips -->
            <div class="flex flex-wrap gap-1.5">
              {#each g.mechanics as mech}
                <span
                  class="badge badge-ghost font-medium text-xs text-base-content/60 px-2.5 py-2.5 bg-base-200/60"
                  >{mech}</span
                >
              {/each}
            </div>

            <div
              class="card-actions justify-end border-t border-base-200/50 pt-4 mt-2"
            >
              <button
                class="btn btn-primary btn-md shadow-sm gap-2 hover:scale-105 transition-transform duration-200 w-full sm:w-auto"
                on:click={() => joinLobby(g.link)}
              >
                <span>Find games</span>
                <span class="material-icons text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Realtime Playground DevTool Banner -->
  <a href="/realtime" class="rt-playground-banner">
    <div class="rt-playground-banner-glow"></div>
    <span class="rt-playground-icon">⚡</span>
    <div>
      <div class="rt-playground-title">Realtime Playground</div>
      <div class="rt-playground-desc">
        Draw, send emoji, chat & poll — all synced live with Supabase Realtime
      </div>
    </div>
    <span class="material-icons rt-playground-arrow">arrow_forward</span>
  </a>
</div>

<style>
  .rt-playground-banner {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin-top: 2.5rem;
    padding: 1.25rem 1.75rem;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.12) 0%,
      rgba(168, 85, 247, 0.1) 100%
    );
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 20px;
    text-decoration: none;
    position: relative;
    overflow: hidden;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }
  .rt-playground-banner:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(99, 102, 241, 0.25);
  }
  .rt-playground-banner-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 30% 50%,
      rgba(99, 102, 241, 0.15),
      transparent 70%
    );
    pointer-events: none;
  }
  .rt-playground-icon {
    font-size: 2.2rem;
    filter: drop-shadow(0 0 12px #818cf8);
    animation: rt-pulse 2s ease-in-out infinite;
  }
  @keyframes rt-pulse {
    0%,
    100% {
      filter: drop-shadow(0 0 8px #818cf8);
    }
    50% {
      filter: drop-shadow(0 0 20px #a78bfa);
    }
  }
  .rt-playground-title {
    font-size: 1.05rem;
    font-weight: 800;
    background: linear-gradient(90deg, #818cf8, #a78bfa, #f472b6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .rt-playground-desc {
    font-size: 0.8rem;
    color: oklch(var(--bc) / 0.55);
    margin-top: 0.15rem;
  }
  .rt-playground-arrow {
    margin-left: auto;
    color: #818cf8;
    font-size: 1.5rem;
  }
</style>
