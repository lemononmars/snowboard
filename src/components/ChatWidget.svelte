<script>
  import { onMount, tick } from "svelte";
  import socket from "../stores/socket.js";
  import { selfInfo } from "../stores/self.js";

  let isOpen = false;
  let activeTab = "global"; // "global" | "room"
  let inputValue = "";
  let unreadCount = 0;

  let globalMessages = [];
  let roomMessages = [];
  let chatContainer;

  $: inRoom = $selfInfo.roomID && $selfInfo.roomID !== "lobby";

  // Auto-switch to Room tab if entering a room
  $: {
    if (inRoom && activeTab === "global" && isOpen === false) {
      activeTab = "room";
    }
  }

  onMount(() => {
    socket.on("global chat message", (msg) => {
      globalMessages = [...globalMessages, msg].slice(-100);
      if (!isOpen || activeTab !== "global") {
        unreadCount++;
      }
      scrollToBottom();
    });

    socket.on("room chat message", (msg) => {
      roomMessages = [...roomMessages, msg].slice(-100);
      if (!isOpen || activeTab !== "room") {
        unreadCount++;
      }
      scrollToBottom();
    });
  });

  async function scrollToBottom() {
    await tick();
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      unreadCount = 0;
      scrollToBottom();
    }
  }

  function handleSend(e) {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    if (activeTab === "global") {
      socket.sendGlobalChat(inputValue.trim());
    } else if (activeTab === "room" && inRoom) {
      socket.sendRoomChat(inputValue.trim());
    }
    inputValue = "";
    scrollToBottom();
  }

  function selectTab(tab) {
    if (tab === "room" && !inRoom) return;
    activeTab = tab;
    unreadCount = 0;
    scrollToBottom();
  }

  function formatTime(isoStr) {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  $: messages = activeTab === "global" ? globalMessages : roomMessages;
</script>

<!-- Floating Chat Container -->
<div class="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-3 font-sans">
  
  <!-- Collapsible Chat Window -->
  {#if isOpen}
    <div class="w-80 sm:w-96 h-[450px] bg-base-100/90 backdrop-blur-md rounded-3xl border border-base-200 shadow-2xl flex flex-col overflow-hidden animate-fade-in relative">
      
      <!-- Chat Header / Tabs -->
      <div class="flex border-b border-base-200/50 bg-base-200/30 p-2 gap-1.5 flex-none">
        <button
          class="flex-1 py-2 px-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5
            {activeTab === 'global'
              ? 'bg-primary text-primary-content shadow-md'
              : 'text-base-content/60 hover:text-base-content hover:bg-base-200/55'}"
          on:click={() => selectTab("global")}
        >
          <span class="material-icons text-sm">public</span>
          Global
        </button>
        <button
          class="flex-1 py-2 px-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5
            {!inRoom
              ? 'opacity-40 cursor-not-allowed text-base-content/40'
              : activeTab === 'room'
                ? 'bg-secondary text-secondary-content shadow-md'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-200/55'}"
          disabled={!inRoom}
          on:click={() => selectTab("room")}
        >
          <span class="material-icons text-sm">sports_esports</span>
          Room
        </button>
      </div>

      <!-- Messages Area -->
      <div
        class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 bg-base-100/20"
        bind:this={chatContainer}
      >
        {#if messages.length === 0}
          <div class="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2">
            <span class="material-icons text-4xl text-base-content/20">chat_bubble_outline</span>
            <h4 class="font-bold text-sm text-base-content/60">No messages yet</h4>
            <p class="text-xs text-base-content/40 max-w-[200px]">
              {#if activeTab === "global"}
                Say hello to everyone online!
              {:else}
                Chat with other players in your game room!
              {/if}
            </p>
          </div>
        {:else}
          {#each messages as msg}
            {@const isMe = msg.userID === $selfInfo.userID}
            <div class="flex flex-col {isMe ? 'items-end' : 'items-start'}">
              <!-- Name & Time -->
              <div class="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-bold text-base-content/40">
                <span>{msg.username}</span>
                <span>•</span>
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <!-- Text Bubble -->
              <div
                class="max-w-[75%] rounded-2xl px-4 py-2 text-sm font-medium break-words shadow-sm
                  {isMe
                    ? activeTab === 'global'
                      ? 'bg-primary text-primary-content rounded-tr-none'
                      : 'bg-secondary text-secondary-content rounded-tr-none'
                    : 'bg-base-200 text-base-content/95 rounded-tl-none'}"
              >
                {msg.message}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer / Input Form -->
      <form
        class="p-3 border-t border-base-200/50 bg-base-200/20 flex gap-2 flex-none"
        on:submit={handleSend}
      >
        <input
          type="text"
          placeholder={!inRoom && activeTab === 'room' ? 'Join a room to chat...' : 'Type message...'}
          disabled={!inRoom && activeTab === 'room'}
          class="input input-bordered input-md rounded-2xl flex-1 text-sm bg-base-100/70 border-base-300 focus:input-primary focus:outline-none focus:ring-0"
          bind:value={inputValue}
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || (!inRoom && activeTab === 'room')}
          class="btn btn-md btn-circle rounded-2xl shadow-sm transition-all duration-200
            {activeTab === 'global' ? 'btn-primary' : 'btn-secondary'}"
        >
          <span class="material-icons text-sm">send</span>
        </button>
      </form>
    </div>
  {/if}

  <!-- Toggle Button -->
  <button
    class="btn btn-circle btn-lg bg-base-100/80 backdrop-blur-md border border-base-200 shadow-2xl hover:scale-105 hover:bg-base-200/60 active:scale-95 transition-all duration-200 relative text-base-content cursor-pointer"
    on:click={toggleChat}
  >
    {#if isOpen}
      <span class="material-icons text-2xl">close</span>
    {:else}
      <span class="material-icons text-2xl">chat</span>
      {#if unreadCount > 0}
        <span class="badge badge-error badge-sm absolute -top-1 -right-1 font-bold animate-bounce shadow-md">
          {unreadCount}
        </span>
      {/if}
    {/if}
  </button>
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
