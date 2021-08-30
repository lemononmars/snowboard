<script>
	import TopAppBar, { Row, Section, Title } from '@smui/top-app-bar';
	import {goto} from '@sapper/app';
	import IconButton from '@smui/icon-button';
	export let pageTitle =''
  
	  function changeTab(tab){
		 switch(tab){
			case 'Home': goto('/'); break;
			case 'Settings': goto('/settings'); break;
			default:;
		 }
	  }
 </script>
 
<nav>
	<div class="top-app-bar-container flexor">
		<TopAppBar variant="static">
		  <Row>
			 <Section>
				<IconButton class="material-icons" aria-label="Back home" on:click={()=>changeTab('Home')}
				  >home</IconButton
				>
				<Title>{pageTitle}</Title>
			 </Section>
			 <Section align="end" toolbar>
				
				<IconButton class="material-icons" aria-label="Settings" on:click={()=>changeTab('Settings')}
				  >settings</IconButton>
			 </Section>
		  </Row>
		</TopAppBar>
	 </div>
</nav>
