<script>
  import Nav from "../components/Nav.svelte";
  import SettingsModal from "../components/SettingsModal.svelte";
  import ChatWidget from "../components/ChatWidget.svelte";
  import "../app.css";
  import { selfInfo } from "../stores/self";
  import { isSettingsOpen } from "../stores/ui";
  import { onMount } from "svelte";

  onMount(() => {
    selfInfo.useLocalStorage();
  });

  $: {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', $selfInfo.isDarkMode ? 'night' : 'winter');
    }
  }
</script>

<Nav/>

<slot></slot>

<ChatWidget />

{#if $isSettingsOpen}
  <SettingsModal />
{/if}