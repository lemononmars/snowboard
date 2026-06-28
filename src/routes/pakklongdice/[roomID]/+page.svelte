<script>
  import { page } from "$app/stores";
  import { stateIndex, gameInfo, gameConfigs } from "../../../stores/game";
  import { selfInfo } from "../../../stores/self";
  import socket from "../../../stores/socket";
  import GameShell from "../../../components/GameShell.svelte";
  import InfoArea from "../InfoArea.svelte";
  import Settings from "../Settings.svelte";

  $: roomID = $page.params.roomID;

  const GAME_STATUS_PREGAME = 0;
  const GAME_STATUS_WAITING = 1;
  const GAME_STATUS_PLAYING = 2;
  const GAME_STATUS_GAMEEND = 3;

  // ── Pakklongdice-specific state ──────────────────────────────────────────────
  var chosenAnswer = -1;
  var actionStatus = new Array(4).fill(0);

  $: actionButtonImgUrl = [0, 1, 2, 3].map(
    (x) => `/pakklongdice/img/${$gameConfigs.chosenTheme}/${x + 1}.png`,
  );

  // ── Game-specific socket listeners ───────────────────────────────────────────
  // These run alongside GameShell's shared listeners.

  // Reset answer state only when entering the active PLAYING state
  $: {
    if ($stateIndex === GAME_STATUS_PLAYING) {
      chosenAnswer = -1;
      actionStatus = new Array(4).fill(0);
    }
  }

  socket.on("end round", (data) => {
    // Highlight the correct answer button
    const correct = data.roundInfo?.roundAnswer;
    if (correct >= 0) {
      actionStatus[correct] = 2;
      actionStatus = actionStatus;
    }
  });

  socket.on("game aborted", () => {
    chosenAnswer = -1;
    actionStatus = new Array(4).fill(0);
  });

  // ── Action handler ───────────────────────────────────────────────────────────

  function handleAction(emitAction, ans) {
    if ($stateIndex !== GAME_STATUS_PLAYING || chosenAnswer !== -1) return;
    chosenAnswer = ans;
    actionStatus[ans] = 1;
    actionStatus = actionStatus;
    stateIndex.set(GAME_STATUS_WAITING); // optimistically wait for result
    emitAction({ action: ans, roundScore: 0, time: 0 });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function buildAnswerLists(actionList) {
    const al = [[], [], [], []];
    for (const id in actionList) {
      const entry = actionList[id];
      const name = $gameInfo.playerInfo?.usernames?.[id] ?? id;
      al[entry.action]?.push([name, entry.roundScore]);
    }
    return al;
  }
</script>

<svelte:head>
  <title>Flower Dice Puzzle — SNOWBOARD</title>
</svelte:head>

<GameShell {roomID} gameTitle="pakklongdice">
  <!-- ── Settings slot: game configuration ───────────────────────── -->
  <svelte:fragment slot="settings">
    <Settings />
  </svelte:fragment>

  <!-- ── Canvas slot: the dice puzzle display ────────────────────── -->
  <svelte:fragment slot="canvas" let:diceReady let:gameInfo>
    {#if diceReady && gameInfo.gameComponents?.dice?.length > 0}
      <InfoArea questionDice={gameInfo.gameComponents.dice} />
    {:else}
      <div class="flex items-center gap-2 text-xs font-semibold text-base-content/40 uppercase tracking-widest animate-pulse">
        <span class="loading loading-dots loading-sm"></span>
        <span>Rolling Dice...</span>
      </div>
    {/if}
  </svelte:fragment>

  <!-- ── Actions slot: 4-button answer grid ──────────────────────── -->
  <svelte:fragment slot="actions" let:stateIndex let:actionList let:emitAction>
    {@const answerLists = buildAnswerLists(actionList)}
    <div class="grid grid-cols-4 gap-3">
      {#each actionButtonImgUrl as url, i}
        <div class="flex flex-col items-center gap-3">
          <!-- Answer button -->
          <button
            class="aspect-square w-full rounded-2xl border-4 transition-all duration-200 hover:scale-105 active:scale-95 shadow-md flex items-center justify-center p-2.5 bg-base-100 cursor-pointer"
            style="
              border-color: {actionStatus[i] === 0
                ? 'rgba(0,0,0,0.1)'
                : actionStatus[i] === 1
                  ? 'oklch(var(--p))'
                  : 'oklch(var(--su))'};
              background-color: {actionStatus[i] === 0
                ? ''
                : actionStatus[i] === 1
                  ? 'oklch(var(--p) / 0.1)'
                  : 'oklch(var(--su) / 0.1)'}
            "
            on:click={() => handleAction(emitAction, i)}
          >
            <img
              src={url}
              alt="Answer option {i + 1}"
              class="w-full h-full object-contain select-none"
            />
          </button>

          <!-- Players who answered this option -->
          <div class="flex flex-col gap-1 text-center w-full min-h-[40px]">
            {#each answerLists[i].slice(0, 2) as [name, score]}
              <div class="badge badge-sm font-medium py-1.5 w-full text-ellipsis overflow-hidden whitespace-nowrap bg-base-200 text-base-content/75 border-base-300">
                {name}
                {#if stateIndex !== GAME_STATUS_PLAYING}
                  <span class="font-bold text-primary ml-1">+{score}</span>
                {/if}
              </div>
            {/each}
            {#if answerLists[i].length > 2}
              <div class="text-[10px] font-bold text-base-content/40 tracking-wider mt-0.5 animate-pulse">
                +{answerLists[i].length - 2} more
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </svelte:fragment>
</GameShell>
