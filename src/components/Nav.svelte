<script>
	import Tab, { Label } from '@smui/tab';
	import {goto} from '@sapper/app';
	import TabBar from '@smui/tab-bar';
  
	  function changeTab(tab){
		 switch(tab){
			case 'Home': goto('/'); break;
			case 'Dice': goto('/pakklongdice'); break;
			case 'Card': goto('/pakklongcard'); break;
			case 'About': goto('/about'); break;
			case 'Settings': goto('/settings'); break;
			default:;
		 }
	  }
 </script>
 
<nav>
	<div>
		<TabBar tabs={['Home', 'Dice', 'Card', 'About', 'Settings']} let:tab>
		  <Tab {tab} minWidth on:click={()=>changeTab(tab)}>
			 <Label>{tab}</Label>
		  </Tab>
		</TabBar>
	 </div>
</nav>
