<script>
	import {selfInfo} from '../stores/self'
	import Textfield from '@smui/textfield'
	import {onMount} from 'svelte'
	import Switch from '@smui/switch';
  	import FormField from '@smui/form-field';

	let name = 'name'
	let isDarkMode = false;
	$: modeText = isDarkMode? 'dark':'light'

	onMount(() => {
		selfInfo.useLocalStorage()
	})
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<div id = 'main'>
	<h2>Change name</h2>
	<Textfield variant="outlined" bind:value={name} />

	<h2>Change theme</h2>
	<FormField>
	<Switch bind:checked={isDarkMode} />
	<span slot="label">{modeText}</span>
	</FormField>
</div>

<style>
#main{
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: auto;
}
</style>