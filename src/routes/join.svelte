<script>
   // join using room ID
// necessary if joinging by URL is disallowed, but let's ignore it for now
	var roomID = ''
	function joinRoom(){
      socket.emit('join room', roomID, (data)=>{
         if(data.available)
            goto(`./${data.gameTitle}/${roomID}`)
         else
            alert(`unable to join because ${data.errorMessage}`)
      })
	}
</script>

<svelte:head>
	<title>Join</title>
</svelte:head>

<h1>Join a game</h1>>
<input bind:value={roomID}>
<button id = 'join-button' on:click={joinRoom}>
	Join!
</button>