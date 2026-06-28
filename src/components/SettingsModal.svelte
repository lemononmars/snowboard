<script>
  import { selfInfo } from '../stores/self';
  import { isSettingsOpen } from '../stores/ui';

  $: modeText = $selfInfo.isDarkMode ? 'Dark Mode (Night Theme)' : 'Light Mode (Winter Theme)'

  function closeModal() {
    isSettingsOpen.set(false);
  }
</script>

<!-- DaisyUI Modal -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal modal-open z-[200] backdrop-blur-sm bg-base-300/40" on:click|self={closeModal}>
  <div class="modal-box max-w-md bg-base-100 rounded-3xl border border-base-200/50 shadow-2xl p-8 relative flex flex-col gap-6">
    <!-- Close icon button -->
    <button 
      class="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-base-content/50 hover:text-base-content" 
      on:click={closeModal}
      aria-label="Close settings"
    >
      <span class="material-icons text-lg">close</span>
    </button>

    <div class="text-center">
      <h2 class="text-3xl font-extrabold tracking-tight text-base-content/90">Settings</h2>
      <p class="text-xs text-base-content/50 mt-1">Configure your personal preferences</p>
    </div>

    <div class="flex flex-col gap-6">
      <!-- Username field -->
      <div class="form-control w-full">
        <label class="label font-semibold text-base-content/70 pb-1" for="modal-username-input">
          <span class="label-text flex items-center gap-1.5">
            <span class="material-icons text-base text-primary">person</span>
            Player Name
          </span>
        </label>
        <input 
          id="modal-username-input"
          type="text" 
          placeholder="Enter your name" 
          class="input input-bordered w-full focus:input-primary transition-all duration-200 font-medium" 
          bind:value={$selfInfo.username} 
        />
      </div>

      <!-- Divider -->
      <div class="divider my-0"></div>

      <!-- Theme toggle -->
      <div class="form-control">
        <label class="label cursor-pointer flex items-center justify-between py-2" for="modal-theme-toggle">
          <span class="label-text font-semibold text-base-content/70 flex items-center gap-1.5">
            <span class="material-icons text-base text-secondary">dark_mode</span>
            {modeText}
          </span> 
          <input 
            id="modal-theme-toggle"
            type="checkbox" 
            class="toggle toggle-primary toggle-lg" 
            bind:checked={$selfInfo.isDarkMode} 
          />
        </label>
      </div>
    </div>

    <div class="modal-action mt-2">
      <button class="btn btn-primary w-full shadow-md rounded-xl" on:click={closeModal}>
        Save & Close
      </button>
    </div>
  </div>
</div>
