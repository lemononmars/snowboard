<script>
	import {selfInfo} from '../../stores/self'
	import {onMount} from 'svelte'

	$: modeText = $selfInfo.isDarkMode ? 'Dark Mode (Night Theme)' : 'Light Mode (Winter Theme)'

	onMount(() => {
		selfInfo.useLocalStorage()
	})
</script>

<svelte:head>
	<title>Settings - SNOWBOARD</title>
</svelte:head>

<div class="max-w-md mx-auto my-8 p-8 bg-base-100 rounded-3xl border border-base-200/50 shadow-xl winter-card-glow">
	<div class="text-center mb-6">
		<h1 class="text-3xl font-extrabold tracking-tight text-base-content/90">Settings</h1>
		<p class="text-sm text-base-content/60 mt-1">Configure your personal preferences</p>
	</div>

	<div class="flex flex-col gap-6">
		<!-- Username card -->
		<div class="form-control w-full">
			<label class="label font-semibold text-base-content/70 pb-1" for="username-input">
				<span class="label-text flex items-center gap-1.5">
					<span class="material-icons text-base">person</span>
					Player Name
				</span>
			</label>
			<input 
				id="username-input"
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
			<label class="label cursor-pointer flex items-center justify-between py-2" for="theme-toggle">
				<span class="label-text font-semibold text-base-content/70 flex items-center gap-1.5">
					<span class="material-icons text-base">dark_mode</span>
					{modeText}
				</span> 
				<input 
					id="theme-toggle"
					type="checkbox" 
					class="toggle toggle-primary toggle-lg" 
					bind:checked={$selfInfo.isDarkMode} 
				/>
			</label>
		</div>
	</div>
</div>