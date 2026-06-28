<script>
  import { page } from '$app/stores';
  import { dev } from '$app/environment';
</script>

<svelte:head>
  <title>{$page.status} — SNOWBOARD</title>
</svelte:head>

<div class="max-w-md mx-auto my-16 px-4">
  <div class="card bg-base-100 border border-base-200/50 shadow-xl winter-card-glow p-8 text-center flex flex-col gap-6">
    <div class="flex justify-center">
      <div class="p-4 bg-error/10 text-error rounded-3xl border border-error/20 flex items-center justify-center animate-pulse">
        <span class="material-icons text-5xl">warning</span>
      </div>
    </div>

    <div>
      <h1 class="text-6xl font-black tracking-tight text-base-content/40 font-mono mb-2">{$page.status}</h1>
      <h2 class="text-xl font-bold text-base-content/80">Oops! An error occurred</h2>
      <p class="text-sm text-base-content/60 mt-2 max-w-xs mx-auto leading-relaxed">
        {$page.error?.message || "We couldn't load the page you requested."}
      </p>
    </div>

    {#if dev && $page.error?.stack}
      <div class="collapse collapse-arrow border border-base-200 bg-base-200/30 rounded-2xl text-left">
        <input type="checkbox" class="peer" /> 
        <div class="collapse-title text-xs font-bold text-base-content/50 font-mono uppercase tracking-wider">
          Developer Stack Trace
        </div>
        <div class="collapse-content overflow-x-auto text-[10px] font-mono text-error p-4 bg-base-300/35 rounded-b-2xl max-h-48 border-t border-base-200 select-text">
          <pre>{$page.error.stack}</pre>
        </div>
      </div>
    {/if}

    <div class="mt-2">
      <a href="/" class="btn btn-primary w-full gap-2 shadow-sm">
        <span class="material-icons text-sm">home</span>
        Return Home
      </a>
    </div>
  </div>
</div>
