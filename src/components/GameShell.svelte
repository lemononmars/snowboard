<script>
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { gameInfo, gameConfigs, stateIndex } from "../stores/game";
  import { selfInfo } from "../stores/self";
  import socket from "../stores/socket";

  export let roomID;
  export let gameTitle = "";

  const GAME_STATUS_PREGAME = 0;
  const GAME_STATUS_WAITING = 1;
  const GAME_STATUS_PLAYING = 2;
  const GAME_STATUS_GAMEEND = 3;

  // Shared game state managed by the shell
  var actionList = {};
  let roundStartTimeout = null;
  let diceReady = false; // true only after cooldown countdown ends

  var timer = {
    interval: null,
    percentage: 0,
    coolDownTime: 0,
    roundTime: 0,
    color: "orangered",
  };
  $: progressClass =
    timer.color === "cyan"
      ? "progress-accent"
      : timer.color === "orangered"
        ? "progress-error"
        : "progress-success";

  $: scoreBoard = updateScoreboard($gameInfo.playerInfo);
  $: difficulty_str = { 1: "easy", 2: "medium", 3: "hard" }[$gameConfigs?.difficulty] ?? "";

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  onMount(() => {
    selfInfo.useLocalStorage();
    socket.emit("join room", { roomID, username: $selfInfo.username }, (res) => {
      if (!res?.successful) {
        goto(`/${gameTitle}?error=noroomID`);
      } else {
        $selfInfo.roomID = roomID;
      }
    });
  });

  stateIndex.set(GAME_STATUS_PREGAME);
  gameInfo.set({
    roundInfo: { round: 0 },
    playerInfo: { usernames: {}, scores: {}, actions: {} },
  });

  function emitUserDisconnect() {
    socket.emit("disconnect", $selfInfo.userID);
  }

  // ── Socket handlers (shared across all games) ────────────────────────────────

  socket.on("add player", (data) => {
    $gameInfo.playerInfo.usernames[data.userID] = data.username;
    $gameInfo.playerInfo.scores[data.userID] = 0;
    $gameInfo = $gameInfo; // trigger reactivity
  });

  socket.on("remove player", (data) => {
    delete $gameInfo.playerInfo.usernames[data.userID];
    $gameInfo = $gameInfo;
  });

  socket.on("new game", (data) => {
    timer.coolDownTime = data.gameConfigs.solo ? 2 : 5;
    timer.roundTime = data.gameConfigs.difficulty === 3 ? 15 : 10;
    $gameConfigs.chosenTheme = data.gameConfigs.chosenTheme;
    $gameInfo = data;
    actionList = {};
    diceReady = false;
    stateIndex.set(GAME_STATUS_WAITING);
  });

  socket.on("new round", (data) => {
    $gameInfo = data;
    // Keep actionList during cooldown
    diceReady = false;
    stateIndex.set(GAME_STATUS_WAITING);

    if (roundStartTimeout) clearTimeout(roundStartTimeout);

    setTimer(timer.coolDownTime, "cyan");
    roundStartTimeout = setTimeout(() => {
      actionList = {}; // Clear actionList when gameplay starts
      diceReady = true;
      stateIndex.set(GAME_STATUS_PLAYING);
      setTimer(timer.roundTime, "orangered");
    }, timer.coolDownTime * 1000);
  });

  socket.on("update answers", (act) => {
    actionList[act.userID] = act.action;
    actionList = actionList;
  });

  socket.on("end round", (data) => {
    setTimer(0, "aquamarine");
    $gameInfo = data;
    actionList = data.playerInfo.actions;
  });

  socket.on("end game", (data) => {
    setTimer(0, "blue");
    stateIndex.set(GAME_STATUS_GAMEEND);
    $gameInfo = data;
  });

  socket.on("game aborted", (data) => {
    setTimer(0, "blue");
    stateIndex.set(GAME_STATUS_PREGAME);
    $gameInfo = data;
    clearInterface();
  });

  // ── Control functions ────────────────────────────────────────────────────────

  function startGame() {
    socket.emit("start game", $gameConfigs);
  }

  function abort() {
    socket.emit("abort");
    clearInterface();
    stateIndex.set(GAME_STATUS_PREGAME);
  }

  function restart() {
    stateIndex.set(GAME_STATUS_PREGAME);
    clearInterface();
  }

  function returnToLobby() {
    socket.emit("leave room", roomID);
    goto(`/${gameTitle}`);
  }

  function clearInterface() {
    actionList = {};
    diceReady = false;
    clearInterval(timer.interval);
    timer.percentage = 0;
    if (roundStartTimeout) {
      clearTimeout(roundStartTimeout);
      roundStartTimeout = null;
    }
  }

  // Exposed to the actions slot so game pages can submit without importing socket
  function emitAction(data) {
    socket.emit("submit action", data);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function updateScoreboard(pinfo) {
    if (!pinfo?.usernames) return [];
    const items = Object.entries(pinfo.usernames).map(([id, name]) => [
      0,
      name,
      pinfo.scores?.[id] ?? 0,
    ]);
    items.sort((a, b) => b[2] - a[2]);
    let rank = 1;
    for (let i = 0; i < items.length; i++) {
      if (i > 0 && items[i][2] !== items[i - 1][2]) rank = i + 1;
      items[i][0] = rank;
    }
    return items.map(([rank, username, score]) => ({ rank, username, score }));
  }

  function setTimer(time, color) {
    clearInterval(timer.interval);
    timer.color = color;
    if (time <= 0) {
      timer.percentage = 0;
      return;
    }
    let t = time;
    timer.interval = setInterval(() => {
      t -= 0.01;
      if (t <= 0) {
        t = 0;
        clearInterval(timer.interval);
      }
      timer.percentage = 100 - (t / time) * 100;
    }, 10);
  }
</script>

<svelte:window on:unload={emitUserDisconnect} />

<div class="max-w-5xl mx-auto my-8 px-4">

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Left / Center: Game area -->
    <div class="lg:col-span-2 flex flex-col gap-6 bg-base-100 p-6 rounded-3xl border border-base-200/50 shadow-xl winter-card-glow">

      <!-- Actions slot (moved to the top to prevent layout shifting between states) -->
      <div class="w-full">
        <slot
          name="actions"
          stateIndex={$stateIndex}
          gameInfo={$gameInfo}
          {actionList}
          {emitAction}
        />
      </div>

      <!-- Dynamic panel (height-locked only during active game states to prevent button shift) -->
      <div class="flex flex-col justify-start gap-4 w-full border-t border-base-200/50 pt-4 {$stateIndex !== GAME_STATUS_PREGAME ? 'min-h-[220px] md:h-[330px]' : ''}">

        <!-- Round status bar (shown during and after game) -->
        {#if $stateIndex !== GAME_STATUS_PREGAME && $gameInfo?.roundInfo}
          <div class="flex flex-wrap items-center justify-between gap-4 bg-base-200/60 px-4 py-2.5 rounded-2xl border border-base-300/40">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-base-content/60">
              <span class="flex items-center gap-1">
                <span class="material-icons text-[14px] text-primary">loop</span>
                Round:
                <span class="text-base-content">
                  {$gameInfo.roundInfo.round} / {$gameInfo.gameConfigs?.gameLength}
                </span>
              </span>
              <div class="w-1.5 h-1.5 rounded-full bg-base-300"></div>
              <span class="flex items-center gap-1">
                <span class="material-icons text-[14px] text-secondary">trending_up</span>
                Difficulty:
                <span class="text-base-content capitalize">{difficulty_str}</span>
              </span>
              <div class="w-1.5 h-1.5 rounded-full bg-base-300"></div>
              <span class="flex items-center gap-1">
                <span class="material-icons text-[14px] text-accent">shuffle</span>
                Shuffle:
                <span class="text-base-content uppercase">
                  {$gameInfo.gameConfigs?.shuffle ? "ON" : "OFF"}
                </span>
              </span>
            </div>
            <!-- Abort / Restart inline -->
            <div class="flex items-center gap-2">
              {#if $stateIndex === GAME_STATUS_WAITING || $stateIndex === GAME_STATUS_PLAYING}
                <button class="btn btn-xs btn-error btn-outline font-bold" on:click={abort}>
                  <span class="material-icons text-[10px]">cancel</span> Abort
                </button>
              {/if}
              {#if $stateIndex === GAME_STATUS_GAMEEND}
                <button class="btn btn-xs btn-secondary btn-outline font-bold" on:click={restart}>
                  <span class="material-icons text-[10px]">replay</span> Restart
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Pregame: start button + settings slot -->
        {#if $stateIndex === GAME_STATUS_PREGAME}
          <div class="flex flex-wrap gap-2 justify-center">
            <button
              class="btn btn-primary shadow-sm hover:scale-105 transition-transform duration-200"
              on:click={startGame}
            >
              <span class="material-icons text-sm">play_arrow</span> Start Game!
            </button>
          </div>
          <div class="animate-fade-in">
            <slot name="settings" />
          </div>
        {/if}

        <!-- Timer / progress bar -->
        {#if ($stateIndex === GAME_STATUS_WAITING || $stateIndex === GAME_STATUS_PLAYING) && timer.percentage > 0}
          <div class="w-full flex flex-col gap-1 px-2">
            <div class="flex justify-between items-center text-xs font-semibold text-base-content/50 uppercase tracking-wider">
              <span class="flex items-center gap-1.5 text-primary">
                <span
                  class="inline-block w-1.5 h-1.5 rounded-full animate-pulse
                    {$stateIndex === GAME_STATUS_WAITING ? 'bg-accent' : 'bg-error'}"
                ></span>
                {$stateIndex === GAME_STATUS_WAITING ? "Get Ready! (Cooldown)" : "Round Gameplay"}
              </span>
              <span>{Math.round(100 - timer.percentage)}%</span>
            </div>
            <progress
              class="progress {progressClass} w-full h-3 transition-all duration-100"
              value={timer.percentage}
              max="100"
            ></progress>
          </div>
        {/if}

        <!-- Game canvas slot (hidden during pregame and game-end) -->
        {#if $stateIndex !== GAME_STATUS_PREGAME && $stateIndex !== GAME_STATUS_GAMEEND}
          <div class="h-28 flex items-center justify-center bg-base-200/20 rounded-2xl border border-dashed border-base-200/50 p-2 animate-fade-in">
            <slot
              name="canvas"
              stateIndex={$stateIndex}
              gameInfo={$gameInfo}
              {diceReady}
            />
          </div>
        {/if}
      </div>
    </div>

    <!-- Right column: Leaderboard & Room info -->
    <div class="lg:col-span-1 flex flex-col gap-6">
      <!-- Room ID and Back to Lobby -->
      <div class="bg-base-100 rounded-3xl border border-base-200/50 shadow-xl winter-card-glow p-5 flex items-center justify-between">
        <h2 class="font-extrabold text-lg text-base-content/90">Room #{roomID}</h2>
        <button
          class="btn btn-sm btn-ghost gap-1 px-2.5 py-1 text-base-content/60 hover:text-primary transition-all duration-200 rounded-xl font-bold uppercase tracking-wider text-xs"
          on:click={returnToLobby}
        >
          <span class="material-icons text-sm">arrow_back</span>
          Lobby
        </button>
      </div>
      <div class="bg-base-100 rounded-3xl border border-base-200/50 shadow-xl winter-card-glow p-5">
        <div class="flex items-center gap-2 mb-4">
          <span class="material-icons text-warning">emoji_events</span>
          <h2 class="font-bold text-lg text-base-content/90">Leaderboard</h2>
        </div>
        <div class="overflow-x-auto w-full">
          <table class="table table-zebra w-full text-sm">
            <thead>
              <tr class="border-b border-base-200 text-base-content/60 uppercase tracking-wider text-xs">
                <th class="w-16 text-center">Rank</th>
                <th>Player</th>
                <th class="w-20 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {#each scoreBoard as row}
                <tr class="hover border-none font-medium text-base-content/85">
                  <td class="text-center">
                    {#if row.rank === 1}
                      <span class="badge badge-warning font-bold">1st</span>
                    {:else if row.rank === 2}
                      <span class="badge badge-secondary badge-outline font-bold">2nd</span>
                    {:else if row.rank === 3}
                      <span class="badge badge-accent badge-outline font-bold">3rd</span>
                    {:else}
                      <span class="opacity-60">{row.rank}</span>
                    {/if}
                  </td>
                  <td class="max-w-[120px] truncate">
                    {row.username}
                    {#if row.username === $selfInfo.username}
                      <span class="text-xs text-primary font-bold">(You)</span>
                    {/if}
                  </td>
                  <td class="text-right font-extrabold text-base-content">{row.score}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
