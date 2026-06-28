<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '../../supabase.js';

  // ── Identity ──────────────────────────────────────────────────────────────
  const COLORS = [
    '#f43f5e','#f97316','#eab308','#22c55e',
    '#06b6d4','#6366f1','#a855f7','#ec4899',
  ];
  const ANIMALS = ['🦊','🐼','🐧','🦋','🐬','🦄','🐸','🐙'];
  const myColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const myAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const myId = Math.random().toString(36).slice(2, 8);
  let myName = $state('');

  // ── Channel ───────────────────────────────────────────────────────────────
  let channel = null;

  // ── Presence (live cursors & users) ──────────────────────────────────────
  let presenceState = $state({});
  let myCursor = $state({ x: 0, y: 0 });

  // ── Drawing ───────────────────────────────────────────────────────────────
  let canvas;
  let ctx;
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let brushColor = $state(myColor);
  let brushSize = $state(6);
  let strokes = $state([]); // [{id, color, size, points:[{x,y}]}]
  let activeStroke = null;
  let drawMode = $state('pen'); // pen | eraser
  let canvasRect = null;

  // ── Emoji Reactions ───────────────────────────────────────────────────────
  const EMOJIS = ['❤️','🔥','🎉','😂','👏','💯','🚀','✨','💀','🫡'];
  let floatingEmojis = $state([]); // {id, emoji, x, y, color}

  // ── Chat ──────────────────────────────────────────────────────────────────
  let messages = $state([]);
  let chatInput = $state('');
  let chatEl;

  // ── Confetti / Celebration ────────────────────────────────────────────────
  let confettiPieces = $state([]);

  // ── Polls ─────────────────────────────────────────────────────────────────
  let pollQuestion = $state('');
  let pollOptions = $state(['', '']);
  let activePoll = $state(null);
  let myVote = $state(null);
  let showPollCreator = $state(false);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  let activeTab = $state('draw'); // draw | chat | poll

  // ── Connection status ─────────────────────────────────────────────────────
  let connected = $state(false);
  let connectionMsg = $state('Connecting to Supabase Realtime...');

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  function getName() {
    return myName || `${myAnimal} Guest`;
  }

  function spawnFloatingEmoji(emoji, x, y, color) {
    const id = Date.now() + Math.random();
    floatingEmojis = [...floatingEmojis, { id, emoji, x, y, color }];
    setTimeout(() => {
      floatingEmojis = floatingEmojis.filter(e => e.id !== id);
    }, 1800);
  }

  function launchConfetti() {
    confettiPieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 1.2,
      size: 6 + Math.random() * 8,
    }));
    setTimeout(() => { confettiPieces = []; }, 3000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas drawing
  // ─────────────────────────────────────────────────────────────────────────
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: ((src.clientX - r.left) / r.width)  * canvas.width,
      y: ((src.clientY - r.top)  / r.height) * canvas.height,
    };
  }

  function redraw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  }

  function startDraw(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getPos(e);
    lastX = x; lastY = y;
    activeStroke = {
      id: myId + '-' + Date.now(),
      color: drawMode === 'eraser' ? '#1e293b' : brushColor,
      size: drawMode === 'eraser' ? 30 : brushSize,
      points: [{ x, y }],
      author: myId,
    };
  }

  function moveDraw(e) {
    if (!isDrawing || !activeStroke) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    activeStroke.points.push({ x, y });

    // Live draw locally
    ctx.beginPath();
    ctx.strokeStyle = activeStroke.color;
    ctx.lineWidth = activeStroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x; lastY = y;

    // Broadcast in-progress strokes every few points
    if (activeStroke.points.length % 4 === 0) {
      channel?.send({
        type: 'broadcast',
        event: 'draw_segment',
        payload: {
          id: activeStroke.id,
          color: activeStroke.color,
          size: activeStroke.size,
          points: activeStroke.points.slice(-5),
          from: myId,
        }
      });
    }
  }

  function endDraw() {
    if (!isDrawing || !activeStroke) return;
    isDrawing = false;
    strokes = [...strokes, activeStroke];
    channel?.send({
      type: 'broadcast',
      event: 'draw_stroke',
      payload: { stroke: activeStroke, from: myId }
    });
    activeStroke = null;
  }

  function clearCanvas() {
    strokes = [];
    ctx?.clearRect(0, 0, canvas?.width, canvas?.height);
    channel?.send({ type: 'broadcast', event: 'clear_canvas', payload: { from: myId } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cursor tracking
  // ─────────────────────────────────────────────────────────────────────────
  function trackMouse(e) {
    const src = e.touches ? e.touches[0] : e;
    myCursor = { x: src.clientX, y: src.clientY };
    channel?.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { x: src.clientX, y: src.clientY, id: myId }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Emoji reactions
  // ─────────────────────────────────────────────────────────────────────────
  function sendEmoji(emoji) {
    const x = 10 + Math.random() * 80;
    const y = 30 + Math.random() * 40;
    spawnFloatingEmoji(emoji, x, y, myColor);
    channel?.send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji, x, y, color: myColor, from: myId, name: getName() }
    });
    if (emoji === '🎉' || emoji === '🚀') launchConfetti();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Chat
  // ─────────────────────────────────────────────────────────────────────────
  function sendChat() {
    if (!chatInput.trim()) return;
    const msg = {
      id: Date.now(),
      text: chatInput.trim(),
      name: getName(),
      color: myColor,
      animal: myAnimal,
      from: myId,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    messages = [...messages, msg];
    channel?.send({ type: 'broadcast', event: 'chat', payload: msg });
    chatInput = '';
    setTimeout(() => { chatEl?.scrollTo(0, chatEl.scrollHeight); }, 50);
  }

  function handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Poll
  // ─────────────────────────────────────────────────────────────────────────
  function sendPoll() {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    const poll = {
      id: Date.now(),
      question: pollQuestion.trim(),
      options: pollOptions.filter(o => o.trim()),
      votes: {},
      from: myId,
      name: getName(),
    };
    activePoll = poll;
    myVote = null;
    showPollCreator = false;
    pollQuestion = '';
    pollOptions = ['', ''];
    channel?.send({ type: 'broadcast', event: 'poll', payload: poll });
  }

  function votePoll(optIdx) {
    if (myVote !== null || !activePoll) return;
    myVote = optIdx;
    activePoll.votes[myId] = optIdx;
    activePoll = { ...activePoll };
    channel?.send({
      type: 'broadcast',
      event: 'poll_vote',
      payload: { pollId: activePoll.id, vote: optIdx, from: myId }
    });
  }

  function getPollVoteCount(idx) {
    return Object.values(activePoll?.votes ?? {}).filter(v => v === idx).length;
  }

  function getTotalVotes() {
    return Object.values(activePoll?.votes ?? {}).length;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Supabase Realtime channel setup
  // ─────────────────────────────────────────────────────────────────────────
  // Remote cursor state keyed by userId
  let remoteCursors = $state({});
  // Remote in-progress strokes keyed by strokeId
  let remoteActiveStrokes = {};

  onMount(() => {
    // Init canvas
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Build channel
    channel = supabase.channel('realtime-playground', {
      config: { broadcast: { self: false }, presence: { key: myId } }
    });

    // ── Presence ──
    channel.on('presence', { event: 'sync' }, () => {
      presenceState = channel.presenceState();
    });

    // ── Drawing ──
    channel.on('broadcast', { event: 'draw_stroke' }, ({ payload }) => {
      if (payload.from === myId) return;
      strokes = [...strokes, payload.stroke];
      delete remoteActiveStrokes[payload.stroke.id];
      redraw();
    });

    channel.on('broadcast', { event: 'draw_segment' }, ({ payload }) => {
      if (payload.from === myId) return;
      // Accumulate points
      if (!remoteActiveStrokes[payload.id]) {
        remoteActiveStrokes[payload.id] = { ...payload, points: [] };
      }
      remoteActiveStrokes[payload.id].points.push(...payload.points);
      // Draw incrementally
      const s = remoteActiveStrokes[payload.id];
      const pts = payload.points;
      if (pts.length >= 2 && ctx) {
        ctx.beginPath();
        ctx.strokeStyle = payload.color;
        ctx.lineWidth = payload.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    });

    channel.on('broadcast', { event: 'clear_canvas' }, () => {
      strokes = [];
      ctx?.clearRect(0, 0, canvas?.width, canvas?.height);
    });

    // ── Cursors ──
    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.id === myId) return;
      remoteCursors = { ...remoteCursors, [payload.id]: { x: payload.x, y: payload.y, id: payload.id } };
    });

    // ── Emoji ──
    channel.on('broadcast', { event: 'emoji' }, ({ payload }) => {
      if (payload.from === myId) return;
      spawnFloatingEmoji(payload.emoji, payload.x, payload.y, payload.color);
      if (payload.emoji === '🎉' || payload.emoji === '🚀') launchConfetti();
    });

    // ── Chat ──
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload.from === myId) return;
      messages = [...messages, payload];
      setTimeout(() => { chatEl?.scrollTo(0, chatEl.scrollHeight); }, 50);
    });

    // ── Poll ──
    channel.on('broadcast', { event: 'poll' }, ({ payload }) => {
      activePoll = payload;
      myVote = null;
    });

    channel.on('broadcast', { event: 'poll_vote' }, ({ payload }) => {
      if (!activePoll || activePoll.id !== payload.pollId) return;
      activePoll.votes[payload.from] = payload.vote;
      activePoll = { ...activePoll };
    });

    // ── Subscribe & track presence ──
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        connected = true;
        connectionMsg = 'Connected!';
        await channel.track({
          id: myId,
          name: getName(),
          color: myColor,
          animal: myAnimal,
          joinedAt: Date.now(),
        });
      } else if (status === 'CHANNEL_ERROR') {
        connectionMsg = 'Connection error — check your Supabase keys';
      }
    });

    // Resize canvas on window resize
    const handleResize = () => {
      if (!canvas) return;
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      if (imageData) ctx?.putImageData(imageData, 0, 0);
      redraw();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  onDestroy(() => {
    channel?.unsubscribe();
  });

  // ── Presence list derived from presenceState ──
  let onlineUsers = $derived(
    Object.values(presenceState).flatMap(arr => arr)
  );
</script>

<svelte:head>
  <title>Realtime Playground ⚡</title>
  <meta name="description" content="Test Supabase Realtime features — drawing, emoji, live cursors, and chat." />
</svelte:head>

<!-- Global mouse tracking -->
<svelte:window onmousemove={trackMouse} ontouchmove={trackMouse} />

<!-- Floating emojis overlay -->
{#each floatingEmojis as fe (fe.id)}
  <div
    class="floating-emoji"
    style="left:{fe.x}vw; top:{fe.y}vh; color:{fe.color}"
    aria-hidden="true"
  >{fe.emoji}</div>
{/each}

<!-- Confetti -->
{#each confettiPieces as c (c.id)}
  <div
    class="confetti-piece"
    style="left:{c.x}vw; background:{c.color}; animation-delay:{c.delay}s; width:{c.size}px; height:{c.size}px;"
    aria-hidden="true"
  ></div>
{/each}

<!-- Remote cursors -->
{#each Object.values(remoteCursors) as cur (cur.id)}
  {@const user = onlineUsers.find(u => u.id === cur.id)}
  {#if user}
    <div class="remote-cursor" style="left:{cur.x}px; top:{cur.y}px; --c:{user.color}" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 2L15 7L9 9L7 15L2 2Z" fill="{user.color}" stroke="white" stroke-width="1.5"/>
      </svg>
      <span class="cursor-label" style="background:{user.color}">{user.animal} {user.name || 'Guest'}</span>
    </div>
  {/if}
{/each}

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<main class="rt-main">

  <!-- Header -->
  <header class="rt-header">
    <div class="rt-header-left">
      <div class="rt-logo">⚡</div>
      <div>
        <h1 class="rt-title">Realtime Playground</h1>
        <p class="rt-subtitle">Powered by Supabase Realtime</p>
      </div>
    </div>

    <div class="rt-header-center">
      <!-- Name input -->
      <div class="rt-name-wrap">
        <span style="font-size:1.25rem">{myAnimal}</span>
        <input
          class="rt-name-input"
          placeholder="Your name…"
          bind:value={myName}
          maxlength="20"
          onchange={async () => {
            await channel?.track({ id: myId, name: getName(), color: myColor, animal: myAnimal });
          }}
        />
        <span class="rt-name-dot" style="background:{myColor}"></span>
      </div>
    </div>

    <div class="rt-header-right">
      <!-- Connection badge -->
      <div class="rt-conn-badge" class:rt-conn-ok={connected}>
        <span class="rt-conn-dot"></span>
        {connected ? `${onlineUsers.length} online` : connectionMsg}
      </div>

      <!-- Online avatars -->
      <div class="rt-avatars">
        {#each onlineUsers.slice(0, 6) as u (u.id)}
          <div class="rt-avatar" style="background:{u.color}" title="{u.animal} {u.name || 'Guest'}">
            {u.animal}
          </div>
        {/each}
        {#if onlineUsers.length > 6}
          <div class="rt-avatar rt-avatar-more">+{onlineUsers.length - 6}</div>
        {/if}
      </div>
    </div>
  </header>

  <!-- Emoji toolbar -->
  <div class="rt-emoji-bar" aria-label="Emoji reactions">
    {#each EMOJIS as emoji}
      <button class="rt-emoji-btn" onclick={() => sendEmoji(emoji)} title="React with {emoji}">
        {emoji}
      </button>
    {/each}
  </div>

  <!-- Tab bar -->
  <div class="rt-tabs">
    {#each [['draw','🎨 Draw'],['chat','💬 Chat'],['poll','📊 Poll']] as [tab, label]}
      <button
        class="rt-tab"
        class:rt-tab-active={activeTab === tab}
        onclick={() => { activeTab = tab; }}
      >{label}</button>
    {/each}
  </div>

  <!-- ── DRAW TAB ────────────────────────────────────────────────────────── -->
  {#if activeTab === 'draw'}
    <div class="rt-draw-area">

      <!-- Toolbar -->
      <div class="rt-draw-toolbar">
        <div class="rt-tool-group">
          <button class="rt-tool-btn" class:rt-tool-active={drawMode==='pen'}  onclick={() => drawMode='pen'}  title="Pen">🖊️</button>
          <button class="rt-tool-btn" class:rt-tool-active={drawMode==='eraser'} onclick={() => drawMode='eraser'} title="Eraser">🧹</button>
        </div>
        <div class="rt-tool-group">
          {#each COLORS as c}
            <button
              class="rt-color-btn"
              class:rt-color-active={brushColor === c && drawMode === 'pen'}
              style="background:{c}"
              onclick={() => { brushColor = c; drawMode = 'pen'; }}
              aria-label="Color {c}"
            ></button>
          {/each}
        </div>
        <div class="rt-tool-group rt-size-group">
          <span class="rt-size-label">Size</span>
          <input type="range" min="2" max="30" bind:value={brushSize} class="rt-size-slider" />
          <span class="rt-size-val">{brushSize}px</span>
        </div>
        <button class="rt-clear-btn" onclick={clearCanvas} title="Clear canvas">🗑️ Clear all</button>
      </div>

      <!-- Canvas -->
      <canvas
        bind:this={canvas}
        class="rt-canvas"
        style="cursor: {drawMode === 'eraser' ? 'cell' : 'crosshair'}"
        onmousedown={startDraw}
        onmousemove={moveDraw}
        onmouseup={endDraw}
        onmouseleave={endDraw}
        ontouchstart={startDraw}
        ontouchmove={moveDraw}
        ontouchend={endDraw}
      ></canvas>

      <!-- Drawing who-is-here strip -->
      <div class="rt-canvas-users">
        {#each onlineUsers as u (u.id)}
          <div class="rt-canvas-user" style="border-color:{u.color}">
            <span>{u.animal}</span>
            <span style="color:{u.color}">{u.name || 'Guest'}</span>
          </div>
        {/each}
      </div>
    </div>

  <!-- ── CHAT TAB ────────────────────────────────────────────────────────── -->
  {:else if activeTab === 'chat'}
    <div class="rt-chat-area">
      <div class="rt-chat-messages" bind:this={chatEl}>
        {#if messages.length === 0}
          <div class="rt-chat-empty">
            <span style="font-size:3rem">💬</span>
            <p>No messages yet. Say hello!</p>
          </div>
        {/if}
        {#each messages as msg (msg.id)}
          <div class="rt-chat-msg" class:rt-chat-mine={msg.from === myId}>
            <div class="rt-chat-avatar" style="background:{msg.color}">{msg.animal}</div>
            <div class="rt-chat-bubble" style="--mc:{msg.color}">
              <div class="rt-chat-meta">
                <span class="rt-chat-name" style="color:{msg.color}">{msg.name}</span>
                <span class="rt-chat-time">{msg.ts}</span>
              </div>
              <p class="rt-chat-text">{msg.text}</p>
            </div>
          </div>
        {/each}
      </div>

      <div class="rt-chat-input-row">
        <div class="rt-emoji-mini">
          {#each EMOJIS.slice(0,5) as e}
            <button class="rt-emoji-mini-btn" onclick={() => { chatInput += e; }}>{e}</button>
          {/each}
        </div>
        <div class="rt-chat-input-wrap">
          <textarea
            class="rt-chat-input"
            placeholder="Type a message… (Enter to send)"
            bind:value={chatInput}
            onkeydown={handleChatKey}
            rows="1"
          ></textarea>
          <button class="rt-chat-send" onclick={sendChat} disabled={!chatInput.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

  <!-- ── POLL TAB ────────────────────────────────────────────────────────── -->
  {:else}
    <div class="rt-poll-area">
      {#if !activePoll && !showPollCreator}
        <div class="rt-poll-empty">
          <span style="font-size:3.5rem">📊</span>
          <p>No active poll. Create one and ask everyone!</p>
          <button class="rt-poll-create-btn" onclick={() => showPollCreator = true}>+ Create Poll</button>
        </div>
      {:else if showPollCreator}
        <div class="rt-poll-creator">
          <h3>Create a Poll</h3>
          <input class="rt-poll-q-input" placeholder="Ask a question…" bind:value={pollQuestion} maxlength="100" />
          <div class="rt-poll-options">
            {#each pollOptions as _, i}
              <div class="rt-poll-option-row">
                <input
                  class="rt-poll-opt-input"
                  placeholder="Option {i + 1}…"
                  bind:value={pollOptions[i]}
                  maxlength="60"
                />
                {#if pollOptions.length > 2}
                  <button class="rt-poll-rm-btn" onclick={() => pollOptions = pollOptions.filter((_, j) => j !== i)}>×</button>
                {/if}
              </div>
            {/each}
            {#if pollOptions.length < 5}
              <button class="rt-poll-add-opt-btn" onclick={() => pollOptions = [...pollOptions, '']}>+ Add option</button>
            {/if}
          </div>
          <div class="rt-poll-creator-btns">
            <button class="rt-poll-cancel-btn" onclick={() => showPollCreator = false}>Cancel</button>
            <button class="rt-poll-send-btn" onclick={sendPoll} disabled={!pollQuestion.trim() || pollOptions.filter(o=>o.trim()).length < 2}>
              Launch Poll 🚀
            </button>
          </div>
        </div>
      {:else if activePoll}
        <div class="rt-poll-active">
          <div class="rt-poll-header">
            <span class="rt-poll-badge">Live Poll</span>
            <span class="rt-poll-author">{activePoll.name} asked:</span>
          </div>
          <h2 class="rt-poll-question">{activePoll.question}</h2>
          <div class="rt-poll-opts">
            {#each activePoll.options as opt, i}
              {@const count = getPollVoteCount(i)}
              {@const total = getTotalVotes()}
              {@const pct = total > 0 ? Math.round((count / total) * 100) : 0}
              <button
                class="rt-poll-opt"
                class:rt-poll-opted={myVote === i}
                class:rt-poll-not-voted={myVote !== null && myVote !== i}
                disabled={myVote !== null}
                onclick={() => votePoll(i)}
              >
                <div class="rt-poll-opt-bar" style="width:{pct}%"></div>
                <span class="rt-poll-opt-text">{opt}</span>
                {#if myVote !== null}
                  <span class="rt-poll-opt-pct">{pct}% ({count})</span>
                {/if}
                {#if myVote === i}
                  <span class="rt-poll-check">✓</span>
                {/if}
              </button>
            {/each}
          </div>
          <div class="rt-poll-footer">
            <span>{getTotalVotes()} vote{getTotalVotes() !== 1 ? 's' : ''}</span>
            {#if activePoll.from === myId || myVote !== null}
              <button class="rt-poll-new-btn" onclick={() => { activePoll = null; myVote = null; showPollCreator = true; }}>
                New Poll
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</main>

<style>
  /* ── Base ─────────────────────────────────────────────────────────────── */
  :global(body) {
    background: #0f172a;
    overflow-x: hidden;
  }

  .rt-main {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
    color: #e2e8f0;
    font-family: 'Inter', 'Outfit', sans-serif;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .rt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: rgba(15,23,42,0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(99,102,241,0.25);
    gap: 1rem;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .rt-header-left { display: flex; align-items: center; gap: 0.75rem; }

  .rt-logo {
    font-size: 2rem;
    filter: drop-shadow(0 0 12px #818cf8);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,100% { filter: drop-shadow(0 0 8px #818cf8); }
    50%      { filter: drop-shadow(0 0 20px #a78bfa); }
  }

  .rt-title {
    font-size: 1.2rem;
    font-weight: 800;
    background: linear-gradient(90deg, #818cf8, #a78bfa, #f472b6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
  }

  .rt-subtitle {
    font-size: 0.7rem;
    color: #64748b;
    margin: 0;
    letter-spacing: 0.05em;
  }

  .rt-header-center { display: flex; justify-content: center; flex: 1; }

  .rt-name-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(30,27,75,0.6);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
  }

  .rt-name-input {
    background: transparent;
    border: none;
    outline: none;
    color: #e2e8f0;
    font-size: 0.85rem;
    font-weight: 600;
    width: 120px;
  }

  .rt-name-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .rt-header-right { display: flex; align-items: center; gap: 1rem; }

  .rt-conn-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(239,68,68,0.15);
    border: 1px solid rgba(239,68,68,0.3);
    border-radius: 999px;
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #f87171;
    transition: all 0.4s;
  }

  .rt-conn-badge.rt-conn-ok {
    background: rgba(34,197,94,0.12);
    border-color: rgba(34,197,94,0.3);
    color: #4ade80;
  }

  .rt-conn-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: currentColor;
    animation: blink 1.4s ease-in-out infinite;
  }

  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .rt-avatars { display: flex; }

  .rt-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem;
    border: 2px solid #0f172a;
    margin-left: -8px;
    transition: transform 0.2s;
  }
  .rt-avatar:hover { transform: scale(1.2); z-index: 5; }
  .rt-avatar-more {
    background: #334155;
    color: #94a3b8;
    font-size: 0.65rem;
    font-weight: 700;
  }

  /* ── Emoji bar ───────────────────────────────────────────────────────── */
  .rt-emoji-bar {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    padding: 0.75rem 1rem;
    background: rgba(15,23,42,0.6);
    border-bottom: 1px solid rgba(99,102,241,0.15);
    flex-wrap: wrap;
  }

  .rt-emoji-btn {
    font-size: 1.5rem;
    background: rgba(30,27,75,0.5);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 12px;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    line-height: 1;
  }
  .rt-emoji-btn:hover {
    transform: scale(1.35) translateY(-4px);
    box-shadow: 0 8px 24px rgba(99,102,241,0.3);
  }
  .rt-emoji-btn:active { transform: scale(0.9); }

  /* ── Tabs ─────────────────────────────────────────────────────────────── */
  .rt-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.75rem 1.5rem 0;
  }

  .rt-tab {
    padding: 0.5rem 1.25rem;
    border-radius: 12px 12px 0 0;
    border: 1px solid rgba(99,102,241,0.2);
    border-bottom: none;
    background: rgba(15,23,42,0.5);
    color: #64748b;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .rt-tab:hover { background: rgba(99,102,241,0.15); color: #e2e8f0; }
  .rt-tab-active {
    background: rgba(30,27,75,0.9);
    color: #a78bfa;
    border-color: rgba(99,102,241,0.4);
  }

  /* ── Draw area ───────────────────────────────────────────────────────── */
  .rt-draw-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: rgba(30,27,75,0.6);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 0 16px 16px 16px;
    margin: 0 1.5rem 1.5rem;
    overflow: hidden;
  }

  .rt-draw-toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.65rem 1rem;
    background: rgba(15,23,42,0.7);
    border-bottom: 1px solid rgba(99,102,241,0.2);
    flex-wrap: wrap;
  }

  .rt-tool-group { display: flex; align-items: center; gap: 0.4rem; }

  .rt-tool-btn {
    font-size: 1.1rem;
    background: rgba(30,27,75,0.6);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 8px;
    padding: 0.35rem 0.55rem;
    cursor: pointer;
    transition: all 0.15s;
    color: #e2e8f0;
  }
  .rt-tool-btn:hover { background: rgba(99,102,241,0.25); }
  .rt-tool-active {
    background: rgba(99,102,241,0.35);
    border-color: #818cf8;
    box-shadow: 0 0 8px rgba(99,102,241,0.4);
  }

  .rt-color-btn {
    width: 24px; height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s;
  }
  .rt-color-btn:hover { transform: scale(1.25); }
  .rt-color-active {
    border-color: white;
    transform: scale(1.25);
    box-shadow: 0 0 8px currentColor;
  }

  .rt-size-group { gap: 0.5rem; }
  .rt-size-label { font-size: 0.72rem; color: #64748b; font-weight: 600; }
  .rt-size-slider { width: 80px; accent-color: #818cf8; }
  .rt-size-val { font-size: 0.72rem; color: #94a3b8; min-width: 28px; }

  .rt-clear-btn {
    margin-left: auto;
    background: rgba(239,68,68,0.12);
    border: 1px solid rgba(239,68,68,0.3);
    color: #f87171;
    border-radius: 8px;
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rt-clear-btn:hover { background: rgba(239,68,68,0.25); }

  .rt-canvas {
    flex: 1;
    width: 100%;
    min-height: 420px;
    display: block;
    touch-action: none;
    background:
      linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
    background-size: 32px 32px;
    background-color: #0f172a;
  }

  .rt-canvas-users {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(15,23,42,0.5);
    border-top: 1px solid rgba(99,102,241,0.15);
    overflow-x: auto;
    flex-wrap: wrap;
  }

  .rt-canvas-user {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    border: 1.5px solid;
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 600;
    background: rgba(15,23,42,0.5);
  }

  /* ── Chat area ───────────────────────────────────────────────────────── */
  .rt-chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: rgba(30,27,75,0.6);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 0 16px 16px 16px;
    margin: 0 1.5rem 1.5rem;
    overflow: hidden;
  }

  .rt-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-height: 400px;
    max-height: 500px;
  }

  .rt-chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    color: #475569;
    font-weight: 500;
    padding: 3rem;
  }

  .rt-chat-msg {
    display: flex;
    gap: 0.65rem;
    align-items: flex-end;
  }

  .rt-chat-mine { flex-direction: row-reverse; }

  .rt-chat-avatar {
    width: 34px; height: 34px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .rt-chat-bubble {
    background: rgba(30,41,59,0.8);
    border: 1px solid rgba(var(--mc), 0.25);
    border-radius: 16px 16px 16px 4px;
    padding: 0.6rem 0.9rem;
    max-width: 75%;
  }

  .rt-chat-mine .rt-chat-bubble {
    border-radius: 16px 16px 4px 16px;
    background: rgba(99,102,241,0.2);
    border-color: rgba(99,102,241,0.35);
  }

  .rt-chat-meta {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.2rem;
  }

  .rt-chat-name { font-size: 0.72rem; font-weight: 700; }
  .rt-chat-time { font-size: 0.65rem; color: #475569; }

  .rt-chat-text {
    font-size: 0.875rem;
    color: #e2e8f0;
    margin: 0;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .rt-emoji-mini {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 1rem 0;
  }
  .rt-emoji-mini-btn {
    font-size: 1.1rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.15rem;
    transition: transform 0.15s;
  }
  .rt-emoji-mini-btn:hover { transform: scale(1.3); }

  .rt-chat-input-row {
    border-top: 1px solid rgba(99,102,241,0.2);
    padding-bottom: 0.5rem;
  }

  .rt-chat-input-wrap {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    padding: 0.5rem 1rem;
  }

  .rt-chat-input {
    flex: 1;
    background: rgba(15,23,42,0.7);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 12px;
    color: #e2e8f0;
    padding: 0.65rem 1rem;
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    outline: none;
    transition: border-color 0.2s;
  }
  .rt-chat-input:focus { border-color: #818cf8; }

  .rt-chat-send {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 12px;
    width: 42px; height: 42px;
    color: white;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
  }
  .rt-chat-send:hover { transform: scale(1.08); }
  .rt-chat-send:disabled { opacity: 0.4; cursor: default; transform: none; }

  /* ── Poll area ───────────────────────────────────────────────────────── */
  .rt-poll-area {
    flex: 1;
    background: rgba(30,27,75,0.6);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 0 16px 16px 16px;
    margin: 0 1.5rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    min-height: 420px;
  }

  .rt-poll-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #475569;
    font-weight: 500;
    text-align: center;
  }

  .rt-poll-create-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 12px;
    color: white;
    font-weight: 700;
    padding: 0.65rem 1.75rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 4px 16px rgba(99,102,241,0.35);
  }
  .rt-poll-create-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.5); }

  .rt-poll-creator {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    max-width: 480px;
  }

  .rt-poll-creator h3 {
    font-size: 1.2rem;
    font-weight: 800;
    color: #a78bfa;
    margin: 0;
  }

  .rt-poll-q-input, .rt-poll-opt-input {
    width: 100%;
    background: rgba(15,23,42,0.7);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 10px;
    color: #e2e8f0;
    padding: 0.65rem 1rem;
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .rt-poll-q-input:focus, .rt-poll-opt-input:focus { border-color: #818cf8; }

  .rt-poll-options { display: flex; flex-direction: column; gap: 0.5rem; }
  .rt-poll-option-row { display: flex; gap: 0.5rem; align-items: center; }
  .rt-poll-rm-btn {
    background: rgba(239,68,68,0.15);
    border: 1px solid rgba(239,68,68,0.3);
    color: #f87171;
    border-radius: 8px;
    width: 32px; height: 32px;
    cursor: pointer;
    font-size: 1.1rem;
    display: flex; align-items: center; justify-content: center;
  }

  .rt-poll-add-opt-btn {
    background: rgba(99,102,241,0.1);
    border: 1px dashed rgba(99,102,241,0.4);
    color: #818cf8;
    border-radius: 8px;
    padding: 0.45rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .rt-poll-add-opt-btn:hover { background: rgba(99,102,241,0.2); }

  .rt-poll-creator-btns { display: flex; gap: 0.75rem; justify-content: flex-end; }

  .rt-poll-cancel-btn {
    background: rgba(30,41,59,0.6);
    border: 1px solid rgba(99,102,241,0.25);
    color: #94a3b8;
    border-radius: 10px;
    padding: 0.6rem 1.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rt-poll-cancel-btn:hover { background: rgba(30,41,59,0.9); }

  .rt-poll-send-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: white;
    font-weight: 700;
    padding: 0.6rem 1.5rem;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
    box-shadow: 0 4px 12px rgba(99,102,241,0.35);
  }
  .rt-poll-send-btn:hover { transform: translateY(-1px); }
  .rt-poll-send-btn:disabled { opacity: 0.4; cursor: default; transform: none; }

  /* Active poll */
  .rt-poll-active {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    max-width: 520px;
  }

  .rt-poll-header { display: flex; align-items: center; gap: 0.75rem; }

  .rt-poll-badge {
    background: linear-gradient(135deg, #f43f5e, #f97316);
    color: white;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    animation: blink 1.5s ease-in-out infinite;
  }

  .rt-poll-author { font-size: 0.8rem; color: #64748b; }

  .rt-poll-question {
    font-size: 1.35rem;
    font-weight: 800;
    color: #e2e8f0;
    margin: 0;
    line-height: 1.4;
  }

  .rt-poll-opts { display: flex; flex-direction: column; gap: 0.65rem; }

  .rt-poll-opt {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(15,23,42,0.6);
    border: 1.5px solid rgba(99,102,241,0.25);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    color: #e2e8f0;
    overflow: hidden;
    transition: border-color 0.2s, transform 0.15s;
    text-align: left;
  }
  .rt-poll-opt:hover:not(:disabled) { border-color: #818cf8; transform: translateX(3px); }
  .rt-poll-opted { border-color: #22c55e; }
  .rt-poll-not-voted { opacity: 0.65; }

  .rt-poll-opt-bar {
    position: absolute;
    left: 0; top: 0;
    height: 100%;
    background: linear-gradient(90deg, rgba(99,102,241,0.18), transparent);
    border-radius: 12px;
    transition: width 0.5s ease;
    pointer-events: none;
  }

  .rt-poll-opted .rt-poll-opt-bar { background: linear-gradient(90deg, rgba(34,197,94,0.22), transparent); }

  .rt-poll-opt-text { position: relative; flex: 1; }
  .rt-poll-opt-pct { position: relative; font-size: 0.78rem; color: #94a3b8; }
  .rt-poll-check { color: #4ade80; font-size: 0.95rem; }

  .rt-poll-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    color: #64748b;
  }

  .rt-poll-new-btn {
    background: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.3);
    color: #818cf8;
    border-radius: 8px;
    padding: 0.3rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rt-poll-new-btn:hover { background: rgba(99,102,241,0.3); }

  /* ── Floating emojis ─────────────────────────────────────────────────── */
  .floating-emoji {
    position: fixed;
    font-size: 2.5rem;
    pointer-events: none;
    z-index: 999;
    animation: float-up 1.8s ease-out forwards;
    filter: drop-shadow(0 0 8px currentColor);
  }

  @keyframes float-up {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    80%  { transform: translateY(-140px) scale(1.3); opacity: 0.8; }
    100% { transform: translateY(-180px) scale(0.6); opacity: 0; }
  }

  /* ── Confetti ─────────────────────────────────────────────────────────── */
  .confetti-piece {
    position: fixed;
    top: -20px;
    border-radius: 3px;
    pointer-events: none;
    z-index: 998;
    animation: confetti-fall 2.8s ease-in forwards;
  }

  @keyframes confetti-fall {
    0%   { transform: translateY(0) rotateZ(0); opacity: 1; }
    100% { transform: translateY(110vh) rotateZ(720deg); opacity: 0; }
  }

  /* ── Remote cursors ──────────────────────────────────────────────────── */
  .remote-cursor {
    position: fixed;
    pointer-events: none;
    z-index: 997;
    transform: translate(-2px, -2px);
    transition: left 0.05s linear, top 0.05s linear;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .cursor-label {
    font-size: 0.65rem;
    font-weight: 700;
    color: white;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    white-space: nowrap;
    margin-left: 12px;
  }

  /* ── Scrollbar ───────────────────────────────────────────────────────── */
  :global(.rt-chat-messages::-webkit-scrollbar) { width: 4px; }
  :global(.rt-chat-messages::-webkit-scrollbar-track) { background: transparent; }
  :global(.rt-chat-messages::-webkit-scrollbar-thumb) { background: rgba(99,102,241,0.3); border-radius: 4px; }
</style>
