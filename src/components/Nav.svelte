<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import socket from '../stores/socket';
	import { selfInfo } from '../stores/self';
	import { isSettingsOpen } from '../stores/ui';

	export let pageTitle = '';
  
	let onlinePlayers = [];

	onMount(() => {
		socket.on('update online players', (data) => {
			onlinePlayers = data;
		});
	});

	function openSettings() {
		isSettingsOpen.set(true);
	}
</script>
 
<nav class="sticky top-0 z-50 w-full bg-base-100/70 backdrop-blur-md border-b border-base-200/60 shadow-sm px-4">
	<div class="navbar max-w-5xl mx-auto p-0 min-h-16 flex items-center justify-between">
		<!-- Left: logo / back home link -->
		<div class="flex items-center gap-1">
			<a href="/" class="btn btn-ghost px-2 gap-2 hover:bg-primary/10 text-primary normal-case flex items-center rounded-xl transition-all duration-200">
				<span class="material-icons text-2xl">home</span>
				<span class="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
					{pageTitle || 'SNOWBOARD'}
				</span>
			</a>
		</div>

		<!-- Right: settings and online players dropdown -->
		<div class="flex items-center gap-2">
			<!-- Online Players Dropdown -->
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-1.5 font-bold hover:bg-primary/10 text-primary transition-all duration-200 rounded-lg">
					<span class="inline-block w-2 h-2 rounded-full bg-success animate-pulse"></span>
					<span class="text-xs uppercase tracking-wider hidden sm:inline">Online:</span>
					<span class="badge badge-sm badge-primary font-extrabold">{onlinePlayers.length || 1}</span>
				</div>
				<!-- Dropdown Content -->
				<ul class="dropdown-content z-[100] menu p-3 shadow-2xl bg-base-100 rounded-2xl w-52 border border-base-200 mt-2">
					<li class="menu-title text-[10px] font-bold uppercase tracking-wider text-base-content/50 px-2 pb-2 border-b border-base-200 mb-1 flex flex-row items-center gap-1.5">
						<span class="material-icons text-xs">group</span>
						Active Players
					</li>
					{#each onlinePlayers as player}
						<li class="text-sm font-semibold text-base-content/80 hover:bg-base-200/50 rounded-lg">
							<span class="flex items-center gap-2 px-2 py-1.5">
								<span class="w-1.5 h-1.5 rounded-full bg-success"></span>
								<span class="truncate">{player.username}</span>
								{#if player.userID === $selfInfo.userID}
									<span class="text-[9px] opacity-50 ml-auto font-medium">(You)</span>
								{/if}
							</span>
						</li>
					{:else}
						<li class="text-sm text-base-content/50 italic px-2 py-2">
							Connecting...
						</li>
					{/each}
				</ul>
			</div>

			<!-- Settings Button -->
			<button class="btn btn-ghost btn-circle text-base-content/70 hover:text-primary hover:bg-primary/10 transition-colors duration-200" on:click={openSettings} aria-label="Settings">
				<span class="material-icons text-2xl">settings</span>
			</button>
		</div>
	</div>
</nav>
