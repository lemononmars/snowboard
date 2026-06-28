<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabase';

  // --- SVELTE 5 RUNES & REACTIVE STATES ---

  // Get the reactive room ID from page parameters
  const roomId = $derived($page.params.roomId);

  // Connection and error states
  let connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
  let errorMsg = $state<string | null>(null);

  // Local player state (using $state)
  const localPlayer = $state({
    id: Math.random().toString(36).substring(2, 11),
    name: 'Player_' + Math.floor(Math.random() * 900 + 100),
    color: '#6366f1', // Indigo
    isReady: false,
    x: 0,
    y: 0
  });

  // Array of active players in the room, synced via Presence (using $state)
  let activePlayers = $state<any[]>([]);

  // Registry of remote players' live cursors (using $state)
  let remoteCursors = $state<Record<string, { id: string; name: string; color: string; x: number; y: number; lastActive: number }>>({});

  // List of placed interactive nodes on the board (using $state)
  let gameNodes = $state<{ id: string; x: number; y: number; color: string; playerName: string }[]>([]);

  // Activity log list for the retro console (using $state)
  let activityLog = $state<{ id: string; time: string; message: string; type: 'info' | 'ready' | 'action' | 'system' }[]>([]);

  // Derived state to calculate the percentage of players who are ready
  const readyPercent = $derived(() => {
    if (activePlayers.length === 0) return 0;
    const readyCount = activePlayers.filter(p => p.isReady).length;
    return Math.round((readyCount / activePlayers.length) * 100);
  });

  // Curated color palette for players
  const colorPalette = [
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Violet', hex: '#8b5cf6' },
    { name: 'Cyan', hex: '#06b6d4' }
  ];

  // Supabase Channel instance
  let channel: any = null;
  let isSubscribed = $state(false);

  // --- LOGGING UTILITY ---
  function addLog(message: string, type: 'info' | 'ready' | 'action' | 'system' = 'info') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    activityLog.unshift({
      id: Math.random().toString(36).substring(2, 9),
      time,
      message,
      type
    });
    // Limit console length to avoid cluttering memory
    if (activityLog.length > 20) {
      activityLog.pop();
    }
  }

  // --- EPHEMERAL OUTGOING BROADCAST WITH THROTTLING ---
  let lastBroadcastTime = 0;
  const THROTTLE_INTERVAL_MS = 50; // Max 20 broadcasts per second to prevent rate limiting

  function handleMouseMove(event: MouseEvent) {
    if (connectionStatus !== 'connected' || !channel || channel.state !== 'joined') return;

    // Get cursor coordinates relative to the interactive arena (%)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // Update local state reactively
    localPlayer.x = x;
    localPlayer.y = y;

    const now = Date.now();
    if (now - lastBroadcastTime >= THROTTLE_INTERVAL_MS) {
      channel.send({
        type: 'broadcast',
        event: 'cursor-move',
        payload: {
          id: localPlayer.id,
          name: localPlayer.name,
          color: localPlayer.color,
          x,
          y
        }
      });
      lastBroadcastTime = now;
    }
  }

  // --- INTERACTIVE GAME ACTION (EPHEMERAL BROADCAST) ---
  function handleBoardClick(event: MouseEvent) {
    if (connectionStatus !== 'connected' || !channel) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const newNode = {
      id: Math.random().toString(36).substring(2, 9),
      x,
      y,
      color: localPlayer.color,
      playerName: localPlayer.name
    };

    // Add to local state
    gameNodes.push(newNode);
    addLog(`You placed a marker at (${Math.round(x)}%, ${Math.round(y)}%)`, 'action');

    // Broadcast node placement to other players
    if (channel.state === 'joined') {
      channel.send({
        type: 'broadcast',
        event: 'node-placed',
        payload: newNode
      });
    } else {
      channel.httpSend('node-placed', newNode);
    }
  }

  // Clear local board and notify others
  function clearBoard() {
    gameNodes = [];
    addLog('You cleared the board markers.', 'info');
    if (channel && connectionStatus === 'connected') {
      if (channel.state === 'joined') {
        channel.send({
          type: 'broadcast',
          event: 'board-cleared',
          payload: { playerName: localPlayer.name }
        });
      } else {
        channel.httpSend('board-cleared', { playerName: localPlayer.name });
      }
    }
  }

  // Copy Room Link to Clipboard
  function copyRoomLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      addLog('Room link copied to clipboard!', 'system');
    }
  }

  // --- SVELTE 5 CLIENT LIFECYCLE ($effect) ---

  // Effect 1: Handle Supabase Realtime channel subscription, events, and teardown
  $effect(() => {
    // Prevent execution during SSR (Server-Side Rendering)
    if (!browser || !roomId) return;

    connectionStatus = 'connecting';
    errorMsg = null;
    addLog(`Connecting to real-time room: ${roomId}`, 'system');

    // Initialize Supabase Channel
    channel = supabase.channel(`game-room:${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: localPlayer.id }
      }
    });

    // A. Set up Broadcast event listeners
    // Listen for mouse moves from remote players
    channel.on('broadcast', { event: 'cursor-move' }, ({ payload }: { payload: any }) => {
      remoteCursors[payload.id] = {
        id: payload.id,
        name: payload.name,
        color: payload.color,
        x: payload.x,
        y: payload.y,
        lastActive: Date.now()
      };
    });

    // Listen for marker placements from remote players
    channel.on('broadcast', { event: 'node-placed' }, ({ payload }: { payload: any }) => {
      gameNodes.push(payload);
      addLog(`${payload.playerName} placed a marker at (${Math.round(payload.x)}%, ${Math.round(payload.y)}%)`, 'action');
    });

    // Listen for board resets
    channel.on('broadcast', { event: 'board-cleared' }, ({ payload }: { payload: any }) => {
      gameNodes = [];
      addLog(`${payload.playerName} cleared the board.`, 'info');
    });

    // B. Set up Presence event listener for state synchronization
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const syncedPlayers: any[] = [];

      // Map presence dictionary to flat array
      Object.keys(presenceState).forEach((key) => {
        const entries = presenceState[key];
        if (entries && entries[0]) {
          syncedPlayers.push(entries[0]);
        }
      });

      // Detect join events for system log
      const oldIds = activePlayers.map(p => p.id);
      const newIds = syncedPlayers.map(p => p.id);

      syncedPlayers.forEach(p => {
        if (p.id !== localPlayer.id && !oldIds.includes(p.id)) {
          addLog(`${p.name} entered the room`, 'info');
        }
      });

      // Detect leave events and clean up cursor registry
      activePlayers.forEach(p => {
        if (p.id !== localPlayer.id && !newIds.includes(p.id)) {
          addLog(`${p.name} disconnected`, 'info');
          delete remoteCursors[p.id];
        }
      });

      // Update state rune
      activePlayers = syncedPlayers;
    });

    // C. Subscribe to Channel
    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        connectionStatus = 'connected';
        isSubscribed = true;
        addLog('Socket established. Subscribed to room.', 'system');

        // Track initial presence state
        try {
          await channel.track({
            id: localPlayer.id,
            name: localPlayer.name,
            color: localPlayer.color,
            isReady: localPlayer.isReady,
            joinedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Error tracking initial presence:', err);
        }
      } else if (status === 'CLOSED') {
        connectionStatus = 'disconnected';
        isSubscribed = false;
        addLog('Socket disconnected.', 'system');
      } else if (status === 'CHANNEL_ERROR') {
        connectionStatus = 'disconnected';
        isSubscribed = false;
        errorMsg = 'Supabase Realtime subscription error. Check network connectivity.';
        addLog('Channel error occurred.', 'system');
      }
    });

    // CRUCIAL TEARDOWN: Remove channel on component destruction / page navigation
    return () => {
      if (channel) {
        addLog('Cleaning up: Removing Supabase Realtime channel.', 'system');
        supabase.removeChannel(channel);
      }
    };
  });

  // Effect 2: Auto-sync metadata via Presence whenever localPlayer changes
  $effect(() => {
    // Read reactive variables to register dependencies
    const name = localPlayer.name;
    const color = localPlayer.color;
    const isReady = localPlayer.isReady;

    if (isSubscribed && channel) {
      channel.track({
        id: localPlayer.id,
        name,
        color,
        isReady,
        joinedAt: new Date().toISOString()
      }).catch((err: any) => {
        console.error('Error updating presence tracking:', err);
      });
    }
  });

  // Keep remoteCursors clean by removing stagnant cursors (older than 8 seconds)
  $effect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let updated = false;
      const nextCursors = { ...remoteCursors };

      for (const id in nextCursors) {
        if (now - nextCursors[id].lastActive > 8000) {
          delete nextCursors[id];
          updated = true;
        }
      }

      if (updated) {
        remoteCursors = nextCursors;
      }
    }, 4000);

    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Real-Time Lobby — {roomId}</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
  
  <!-- Header Bar -->
  <header class="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-40">
    <div class="flex items-center gap-3">
      <div class="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/30 flex items-center justify-center">
        <span class="material-icons text-indigo-400 text-2xl">sports_esports</span>
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Supabase Realtime Game Sandbox
        </h1>
        <p class="text-xs text-slate-400 font-medium">Room ID: <span class="text-slate-300 font-mono select-text">{roomId}</span></p>
      </div>
    </div>

    <!-- Toolbar actions and connection status -->
    <div class="flex items-center gap-4">
      <button 
        onclick={copyRoomLink}
        class="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl gap-2 font-semibold"
      >
        <span class="material-icons text-sm">content_copy</span>
        Copy Link
      </button>

      <!-- Connection Status indicator -->
      <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
        {#if connectionStatus === 'connected'}
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="text-xs font-bold text-emerald-400 tracking-wide uppercase">Connected</span>
        {:else}
          <span class="relative flex h-2 w-2">
            <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span class="text-xs font-bold text-amber-400 tracking-wide uppercase">{connectionStatus}</span>
        {/if}
      </div>
    </div>
  </header>

  <!-- Error display -->
  {#if errorMsg}
    <div class="max-w-7xl mx-auto w-full px-6 mt-4">
      <div class="alert alert-error bg-rose-950/40 border-rose-500/30 text-rose-200 rounded-2xl flex gap-3 shadow-lg">
        <span class="material-icons text-rose-400">warning</span>
        <div>
          <h3 class="font-bold text-sm">Connection Issue</h3>
          <p class="text-xs text-rose-300/85">{errorMsg}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Split Layout -->
  <main class="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
    
    <!-- LEFT SIDE: Game Canvas / Interactive Area (8 Cols) -->
    <div class="lg:col-span-8 flex flex-col gap-4">
      
      <!-- Interactive Sandbox -->
      <div class="card bg-slate-900/60 border border-slate-800/80 rounded-3xl shadow-xl flex-grow overflow-hidden flex flex-col min-h-[400px] md:min-h-[500px]">
        
        <!-- Header status for the arena -->
        <div class="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div class="flex items-center gap-2">
            <span class="material-icons text-slate-400 text-lg">games</span>
            <h3 class="font-bold text-slate-200">Interactive Action Canvas</h3>
          </div>
          <button 
            onclick={clearBoard} 
            disabled={gameNodes.length === 0}
            class="btn btn-xs btn-ghost text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
          >
            <span class="material-icons text-xs">refresh</span>
            Clear Canvas
          </button>
        </div>

        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- The Canvas Board itself -->
        <div 
          role="application"
          aria-label="Multiplayer Interactive Arena"
          onmousemove={handleMouseMove}
          onclick={handleBoardClick}
          class="flex-grow relative bg-slate-950/80 cursor-crosshair overflow-hidden group select-none transition-all duration-300"
          style="background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 20px 20px;"
        >
          <!-- Grid Glow Effects -->
          <div class="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-pink-500/5 pointer-events-none"></div>

          <!-- Placed Game Nodes (Synchronized via Broadcast) -->
          {#each gameNodes as node (node.id)}
            <div 
              class="absolute w-8 h-8 rounded-full border-2 border-white flex items-center justify-center -translate-x-1/2 -translate-y-1/2 shadow-lg animate-pulse"
              style="left: {node.x}%; top: {node.y}%; background-color: {node.color}; box-shadow: 0 0 16px {node.color};"
            >
              <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
              <!-- Floating name tag on node -->
              <span class="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700/60 shadow text-slate-300 pointer-events-none">
                {node.playerName}
              </span>
            </div>
          {/each}

          <!-- Remote Pointers / Cursors (Synchronized via Broadcast) -->
          {#each Object.values(remoteCursors) as cursor (cursor.id)}
            <div 
              class="absolute pointer-events-none -translate-x-1 translate-y-1 z-30 transition-all duration-75 ease-out"
              style="left: {cursor.x}%; top: {cursor.y}%;"
            >
              <!-- Glowing Cursor Icon -->
              <span class="material-icons block drop-shadow-md text-xl" style="color: {cursor.color};">
                near_me
              </span>
              <!-- Player Cursor Name Badge -->
              <div 
                class="absolute left-4 top-4 whitespace-nowrap bg-slate-900 border px-2 py-0.5 rounded-md text-[10px] font-bold shadow-lg flex items-center gap-1 text-white"
                style="border-color: {cursor.color};"
              >
                <span class="w-1.5 h-1.5 rounded-full" style="background-color: {cursor.color};"></span>
                {cursor.name}
              </div>
            </div>
          {/each}

          <!-- Local Hover Indicator (optional helper) -->
          <div class="absolute bottom-4 left-4 pointer-events-none bg-slate-900/70 border border-slate-800 px-3 py-1.5 rounded-xl backdrop-blur text-[11px] font-mono text-slate-400 flex gap-2">
            <span>X: {Math.round(localPlayer.x)}%</span>
            <span>Y: {Math.round(localPlayer.y)}%</span>
          </div>

          <!-- Empty Canvas Callout -->
          {#if gameNodes.length === 0}
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none text-slate-500 opacity-60">
              <span class="material-icons text-5xl animate-bounce">mouse</span>
              <p class="text-sm font-semibold tracking-wider uppercase">Move cursor & click to place nodes</p>
              <p class="text-xs text-slate-600">See other users' cursors move in real-time</p>
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Retro Console / Event Logs -->
      <div class="card bg-slate-900/60 border border-slate-800/80 rounded-3xl shadow-xl flex flex-col overflow-hidden h-48">
        <div class="px-5 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <h3 class="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">Live Activity Terminal</h3>
        </div>
        <div class="flex-grow p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col-reverse gap-1.5 bg-slate-950/60 select-text">
          {#each activityLog as log (log.id)}
            <div class="flex items-start gap-2 hover:bg-slate-900/40 px-1 py-0.5 rounded transition-colors">
              <span class="text-slate-500 font-semibold">[{log.time}]</span>
              {#if log.type === 'system'}
                <span class="text-cyan-400 font-semibold">[SYS]</span>
                <span class="text-cyan-200">{log.message}</span>
              {:else if log.type === 'ready'}
                <span class="text-emerald-400 font-semibold">[RDY]</span>
                <span class="text-emerald-200">{log.message}</span>
              {:else if log.type === 'action'}
                <span class="text-pink-400 font-semibold">[ACT]</span>
                <span class="text-pink-200">{log.message}</span>
              {:else}
                <span class="text-indigo-400 font-semibold">[INFO]</span>
                <span class="text-slate-300">{log.message}</span>
              {/if}
            </div>
          {:else}
            <div class="text-slate-600 italic">No events logged yet. Move mouse or toggle status.</div>
          {/each}
        </div>
      </div>

    </div>

    <!-- RIGHT SIDE: Config & Players Sidebar (4 Cols) -->
    <div class="lg:col-span-4 flex flex-col gap-6">

      <!-- Setup / Local Player Panel -->
      <div class="card bg-slate-900/60 border border-slate-800/80 rounded-3xl shadow-xl p-5 md:p-6 flex flex-col gap-5">
        <div class="flex items-center gap-2 border-b border-slate-800/60 pb-3">
          <span class="material-icons text-indigo-400">person</span>
          <h3 class="font-bold text-slate-200">Local Player Settings</h3>
        </div>

        <!-- Name Input -->
        <div class="flex flex-col gap-2">
          <label for="username" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Character Name</label>
          <input 
            id="username"
            type="text" 
            bind:value={localPlayer.name}
            class="input input-bordered w-full bg-slate-950/80 border-slate-800 focus:border-indigo-500/80 text-white rounded-xl font-medium focus:ring-1 focus:ring-indigo-500/30 transition-all text-sm"
            placeholder="Type username..."
          />
        </div>

        <!-- Color Selection -->
        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avatar & Pointer Color</span>
          <div class="grid grid-cols-6 gap-2">
            {#each colorPalette as color}
              <button 
                onclick={() => localPlayer.color = color.hex}
                class="aspect-square rounded-xl transition-all duration-200 relative flex items-center justify-center shadow-inner hover:scale-110 active:scale-95"
                style="background-color: {color.hex};"
                title={color.name}
                aria-label="Select {color.name} color"
              >
                {#if localPlayer.color === color.hex}
                  <span class="material-icons text-white text-base drop-shadow-md">check</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Ready Toggle Switch -->
        <div class="flex items-center justify-between bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 mt-1 transition-all hover:bg-slate-950/60">
          <div class="flex flex-col">
            <span class="text-sm font-bold text-slate-200">Ready Status</span>
            <span class="text-[10px] text-slate-500 font-medium">Signal other lobby players</span>
          </div>
          <button 
            onclick={() => {
              localPlayer.isReady = !localPlayer.isReady;
              addLog(`You flagged status: ${localPlayer.isReady ? 'READY' : 'NOT READY'}`, 'ready');
            }}
            class="btn btn-sm rounded-xl px-4 font-bold border transition-all duration-200 {localPlayer.isReady ? 'bg-emerald-500 border-emerald-400 text-slate-950 hover:bg-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}"
          >
            {localPlayer.isReady ? 'READY' : 'NOT READY'}
          </button>
        </div>
      </div>

      <!-- Realtime Room Lobby List -->
      <div class="card bg-slate-900/60 border border-slate-800/80 rounded-3xl shadow-xl p-5 md:p-6 flex-grow flex flex-col gap-4">
        
        <!-- Header & Lobby Metrics -->
        <div class="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-icons text-indigo-400">people</span>
            <h3 class="font-bold text-slate-200">Connected Lobby</h3>
          </div>
          <span class="badge badge-indigo bg-indigo-500/10 border-indigo-500/30 text-indigo-300 font-bold px-2.5 py-2.5 rounded-lg text-xs">
            {activePlayers.length} Online
          </span>
        </div>

        <!-- Readiness Progress Bar -->
        {#if activePlayers.length > 0}
          <div class="flex flex-col gap-1.5 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Readiness Gauge</span>
              <span class="text-indigo-400 font-bold">{readyPercent()}% Ready</span>
            </div>
            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="bg-indigo-500 h-full transition-all duration-500" style="width: {readyPercent()}%"></div>
            </div>
          </div>
        {/if}

        <!-- Active Users List -->
        <div class="flex-grow overflow-y-auto flex flex-col gap-2.5 pr-1">
          {#each activePlayers as player (player.id)}
            {@const isSelf = player.id === localPlayer.id}
            <div class="flex items-center justify-between bg-slate-950/30 border border-slate-850 p-3 rounded-2xl hover:border-slate-800 transition-all">
              <div class="flex items-center gap-3 min-w-0">
                <!-- Color Dot and connection bubble -->
                <div class="relative flex-shrink-0">
                  <div class="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md" style="background-color: {player.color};">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950"></div>
                </div>
                
                <!-- Player Name Info -->
                <div class="min-w-0 flex flex-col">
                  <span class="text-sm font-semibold text-slate-200 truncate flex items-center gap-1.5">
                    {player.name}
                    {#if isSelf}
                      <span class="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1 py-0.2 rounded uppercase">You</span>
                    {/if}
                  </span>
                  <span class="text-[9px] text-slate-500 font-mono">
                    ID: {player.id.substring(0, 5)}...
                  </span>
                </div>
              </div>

              <!-- Ready State Badge -->
              <div>
                {#if player.isReady}
                  <span class="badge badge-success bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-2 rounded-lg gap-1 uppercase">
                    <span class="material-icons text-[10px] leading-none">done</span>
                    Ready
                  </span>
                {:else}
                  <span class="badge badge-ghost bg-slate-850/50 border-slate-800 text-slate-500 text-[10px] font-bold px-2 py-2 rounded-lg uppercase">
                    Waiting
                  </span>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Empty state for UI robustness -->
            <div class="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
              <span class="material-icons text-3xl animate-pulse">hourglass_empty</span>
              <p class="text-xs font-medium">Acquiring presence data...</p>
            </div>
          {/each}
        </div>

      </div>

    </div>

  </main>
</div>

<style>
  /* Custom glass effect adjustments */
  .card {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
</style>
