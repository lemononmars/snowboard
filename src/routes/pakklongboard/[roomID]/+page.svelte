<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { gameInfo, gameConfigs, stateIndex } from "../../../stores/game";
  import { selfInfo } from "../../../stores/self";
  import socket from "../../../stores/socket";
  import GameShell from "../../../components/GameShell.svelte";

  const roomID = $page.params.roomID;

  // ── Pakklongboard Constants ───────────────────────────────────────────────
  const botNames = ['Mel', 'Game', 'Job', 'Lui', 'Poupe', 'Due', 'Au', 'Som', 'Benz', 'Aon', 'Oak', 'Boat', 'Tana'];
  const playerColors = ['#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899']; // Indigo, Amber, Rose, etc.
  const shopList = ['Restaurant', 'Rose', 'Orchid', 'Mums', 'Bookstore', 'Tool'];
  const shopColors = ['yellow', 'pink', 'skyblue', 'white', 'purple', 'lightgreen'];
  const timeTokenList = [0, 1, 2, 3, 4, 'x', 'x'];
  const bonusTypeString = ['Quality bonus', 'Money bonus', 'Score bonus'];
  const cardLevelStars = ['*', '**', '***'];

  const toolCost = [
    [3, 2, 4],
    [3, 2, 4],
    [1, 2, 1],
    [2, 1, 0],
    [1, 0, 0],
    [1, 1, 1]
  ];

  const toolAmount = [
    [1, 1, 2],
    [1, 1, 2],
    [1, 2, 2],
    [1, 1, 1],
    [1, 1, 1],
    [2, 3, 4]
  ];

  const toolString = [
    ['a clock', 'two clocks', 'two clocks'],
    ['a vase', 'a vase', 'two vases'],
    ['a ribbon', 'two ribbons', 'two ribbons'],
    ['a flower', 'a flower', 'a flower'],
    ['First in Tie Break', 'First in Tie Break', 'First in Tie Break'],
    ['two action cubes', 'three action cubes', 'four action cubes']
  ];

  const achievementString = [
    '6 pink', '6 blue', '6 white',
    '4 pink & 4 blue', '4 pink & 4 white', '4 blue & 4 white',
    '3 pink & blue & white',
    '5 finished cards'
  ];

  const achievementRewards = [
    [0, 0, 0, 5, 0], [0, 0, 0, 5, 0], [0, 0, 0, 5, 0],
    [0, 0, 0, 3, 3], [0, 0, 0, 3, 3], [0, 0, 0, 3, 3],
    [1, 1, 1, 0, 5],
    [0, 0, 0, 5, 0]
  ];

  const startingMoney = 5;
  const handLimit = 4;

  // ── Game States ────────────────────────────────────────────────────────────
  let players = $state([]);
  let numPlayers = $state(0);
  let numBots = $state(0);
  let turn = $state(1);
  let phase = $state(0); // 0 = early bird, 1 = planning, 2 = buy, 3 = aftermarket, 4 = arranging
  let activeShop = $state(0);
  let activeTokenOrder = $state(-1);
  let tieBreak = $state([]);
  let myID = $state(-1);
  let gameID = $state(null);
  let achievements = $state([]);
  let shops = $state([[], [], [], [], [], []]);
  let isDone = $state(false);
  let autoplay = $state(false);
  let buyFlowerToolToken = $state(false);
  let gameState = $state(0);
  let currentPlayer = $state(-1);
  let language = $state('EN');
  let timeStart = null;
  let tutorial = true;
  
  // Arrange phase selection states
  let selectedFlowerCardIndex = $state(-1);
  let selectedVasesIndices = $state([]);
  let chosenRibbons = $state(0);

  // Time token planning states (Phase 1)
  let chosenTimeTokens = $state(new Array(6).fill(null)); // slots for shops 1-6

  let gameLogs = $state([]);
  let numPlayersDone = $state(0);

  // ── Helper functions ───────────────────────────────────────────────────────
  function ran(a) {
    return Math.floor(Math.random() * a);
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = ran(i + 1);
      const temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
  }

  function addLog(msg, playerId = null) {
    const color = playerId !== null && players[playerId] ? players[playerId].color : 'transparent';
    const textColor = playerId !== null ? '#ffffff' : 'currentColor';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    gameLogs = [...gameLogs, { msg, color, textColor, timestamp }];
  }

  function addNoti(msg) {
    if (typeof document !== 'undefined') {
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-center z-[999]';
      toast.innerHTML = `<div class="alert alert-info shadow-lg rounded-2xl font-semibold text-xs border border-base-200"><span>${msg}</span></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    }
  }

  // ── Setup Logic ───────────────────────────────────────────────────────────
  function generateStartingFlowerCards() {
    const cards = [
      [0, 1, 1, 3, 1, 0], [0, 1, 1, 3, 1, 0],
      [1, 0, 1, 3, 1, 0], [1, 0, 1, 3, 1, 0],
      [1, 1, 0, 3, 1, 0], [1, 1, 0, 3, 1, 0]
    ];
    shuffle(cards);
    return cards;
  }

  function getRandomFlowerToken() {
    const type = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
    const qual = [1, 3, 3, 3, 2, 2, 3, 3, 2, 2, 2, 4];
    const idx = ran(type.length);
    return [type[idx], qual[idx]];
  }

  function getRandomFlowerCard() {
    const allCards = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      [[2, 0, 0], [0, 2, 0], [0, 0, 2], [1, 1, 0], [1, 0, 1], [0, 1, 1]],
      [[2, 1, 0], [2, 0, 1], [1, 2, 0], [1, 0, 2], [0, 2, 1], [0, 1, 2], [1, 1, 1]],
      [[2, 2, 0], [2, 0, 2], [0, 2, 2], [2, 1, 1], [1, 2, 1], [1, 1, 2]],
      [[2, 2, 1], [2, 1, 2], [1, 2, 2]]
    ];
    const c = randomWithWeight([2, 6, 6, 3, 0]);
    const card = allCards[c][ran(allCards[c].length)];
    const l = randomWithWeight([3, 2, 1]);
    const total = card[0] + card[1] + card[2];
    const qual = Math.ceil(total * 2.5) + l * 3;
    const score = (total - 1) * 2 + l * 2;
    return [card[0], card[1], card[2], qual, score, l];
  }

  function randomWithWeight(a) {
    let total = a.reduce((sum, val) => sum + val, 0);
    let r = ran(total) + 1;
    let index = 0;
    while (r > a[index] && index < a.length - 1) {
      r -= a[index];
      index++;
    }
    return index;
  }

  function generateGoods(num) {
    const goods = [[], [], [], [], [], []];
    for (let i = 0; i < num; i++) {
      const a = ran(6);
      if (a < 5) goods[0].push(Math.floor((a + 1) / 2) + 1);
    }
    goods[0].sort();

    const flowerTokens = [];
    for (let i = 0; i < num * 2; i++) {
      flowerTokens.push(getRandomFlowerToken());
    }
    flowerTokens.sort((a, b) => a[1] - b[1]);

    for (let i = 0; i < flowerTokens.length; i++) {
      const shopIndex = flowerTokens[i][0] + 1;
      goods[shopIndex].push(flowerTokens[i]);
    }

    for (let i = 0; i < num; i++) {
      goods[4].push(getRandomFlowerCard());
    }
    goods[4].sort((a, b) => a[5] - b[5]);

    // Tools
    goods[5] = [];
    for (let i = 0; i < num; i++) {
      goods[5].push(ran(6));
    }
    return goods;
  }

  // ── Svelte Game Loop Methods ────────────────────────────────────────────────
  function initializeBoard(data) {
    myID = data.players.indexOf($selfInfo.username);
    gameID = data.gameId;
    players = [];
    
    data.players.forEach((username, i) => {
      players.push({
        id: i,
        username,
        color: playerColors[i],
        isBot: false,
        score: 0,
        money: 0,
        numVases: 3,
        vases: [],
        time: 0,
        stars: [0, 0, 0],
        bonus: [0, 1, 2],
        hand: [],
        numPlayedCards: 0,
        numRibbons: 0,
        actionCubes: 0,
        myPlayedTimeTokens: []
      });
    });

    for (let i = 0; i < data.numBots; i++) {
      const bname = botNames[ran(botNames.length)] + '#' + i;
      players.push({
        id: players.length,
        username: bname,
        color: playerColors[players.length],
        isBot: true,
        score: 0,
        money: 0,
        numVases: 3,
        vases: [],
        time: 0,
        stars: [0, 0, 0],
        bonus: [0, 1, 2],
        hand: [],
        numPlayedCards: 0,
        numRibbons: 0,
        actionCubes: 0,
        myPlayedTimeTokens: []
      });
    }

    numPlayers = players.length;
    numBots = data.numBots;
    gameState = 1; // playing
    turn = 1;
    phase = 0;
    timeStart = new Date().getTime();

    if (myID === 0) {
      const bonuses = [0, 1, 2, 3, 4, 5];
      shuffle(bonuses);
      const tie = Array.from({ length: numPlayers }, (_, i) => i);
      shuffle(tie);
      const ach = Array.from({ length: 8 }, (_, i) => i);
      shuffle(ach);
      const selectedAch = ach.slice(0, numPlayers);

      socket.emit('give starting stuff', {
        flowerCards: generateStartingFlowerCards(),
        bonuses: bonuses,
        tieBreak: tie,
        achieve: selectedAch,
        playerColors: playerColors.slice(0, numPlayers)
      });

      socket.emit('generate market', generateGoods(numPlayers));
    }
  }

  // ── Gameplay Logic Mapped to Svelte State ─────────────────────────────────
  function getStars(player) {
    return player.stars;
  }

  function getBonus(player, bonusIndex) {
    return player.stars[player.bonus[bonusIndex]];
  }

  function checkAchievement(type, player) {
    const stars = player.stars;
    switch(type) {
      case 0: return stars[0] >= 6;
      case 1: return stars[1] >= 6;
      case 2: return stars[2] >= 6;
      case 3: return stars[0] >= 4 && stars[1] >= 4;
      case 4: return stars[0] >= 4 && stars[2] >= 4;
      case 5: return stars[1] >= 4 && stars[2] >= 4;
      case 6: return stars[0] >= 3 && stars[1] >= 3 && stars[2] >= 3;
      case 7: return player.numPlayedCards >= 5;
      default: return false;
    }
  }

  function checkEndGame() {
    if (turn >= 10) return true;
    let end = false;
    let maxScore = 0;
    players.forEach(p => {
      let maxStars = Math.max(...p.stars);
      if (maxStars >= 7) {
        end = true;
        p.score += 2;
      }
      if (p.score > maxScore) maxScore = p.score;
    });
    if (maxScore >= 40) end = true;
    return end;
  }

  function getMyTimeTokens(player) {
    const list = [0, 1, 2, 3, 4, 5, 6];
    list.splice(player.time, 1);
    return list;
  }

  function getActiveTimeToken() {
    const list = timeTokensByShop[activeShop] || [];
    const token = list[activeTokenOrder];
    return token ? token.id : -1;
  }

  // Computed state for active time tokens in Phase 2
  let timeTokensByShop = $derived.by(() => {
    if (phase !== 2) return [[], [], [], [], [], []];
    const shopListTokens = Array.from({ length: 6 }, () => []);
    
    // Collect time tokens from all players
    const tempTokens = Array.from({ length: 6 }, () => []);
    players.forEach(p => {
      for (let k = 0; k < 6; k++) {
        tempTokens[k].push({ id: p.id, value: p.myPlayedTimeTokens[k] });
      }
    });

    // Sort time tokens in each shop based on planning rules
    for (let k = 0; k < 6; k++) {
      const shopTokens = tempTokens[k];
      shopTokens.sort((a, b) => {
        if (a.value !== b.value) return a.value - b.value;
        return tieBreak.indexOf(a.id) - tieBreak.indexOf(b.id);
      });
      shopListTokens[k] = shopTokens;
    }
    return shopListTokens;
  });

  function goFirst(id) {
    const idx = tieBreak.indexOf(Number(id));
    if (idx >= 0) {
      tieBreak.splice(idx, 1);
      tieBreak.unshift(Number(id));
    }
  }

  function nextPlayer() {
    let nextP = -1;
    if (phase === 2) {
      activeTokenOrder++;
      if (activeTokenOrder >= numPlayers || getActiveTimeToken() === -1) {
        activeTokenOrder = 0;
        activeShop++;
        while (activeShop < 6 && getActiveTimeToken() === -1) {
          activeShop++;
        }
      }
      if (activeShop < 6) {
        nextP = getActiveTimeToken();
      } else {
        if (myID === 0) socket.emit('end phase', { phase });
        nextP = -1;
      }
    } else if (phase === 0 || phase === 3) {
      const cubesNeeded = phase === 0 ? 3 : 2;
      let idx = currentPlayer === -1 ? 0 : tieBreak.indexOf(Number(currentPlayer)) + 1;
      while (idx < numPlayers && players[tieBreak[idx]].actionCubes < cubesNeeded) {
        idx++;
      }
      if (idx < numPlayers) {
        nextP = tieBreak[idx];
      } else if (myID === 0) {
        socket.emit('end phase', { phase });
        nextP = -1;
      }
    }
    currentPlayer = nextP;

    if (currentPlayer === myID) {
      addNoti('Your Turn !');
    }

    if (currentPlayer >= 0 && myID === 0 && players[currentPlayer].isBot) {
      setTimeout(() => handleBotTurn(currentPlayer), 800);
    }
  }

  // ── Card verification helper ────────────────────────────────────────────────
  function verifyArrangement(card, vasesList, ribbonsUsed, qualityBonus) {
    let sumQuality = qualityBonus + ribbonsUsed * 2;
    const counts = [0, 0, 0];
    vasesList.forEach(t => {
      counts[t.type] += 1;
      sumQuality += t.quality;
    });

    if (sumQuality < card.quality) {
      addNoti("Quality not satisfied");
      return false;
    }
    if (counts[0] < card.flowers[0] || counts[1] < card.flowers[1] || counts[2] < card.flowers[2]) {
      addNoti("Not enough flowers of some type");
      return false;
    }
    if (counts[0] > card.flowers[0] || counts[1] > card.flowers[1] || counts[2] > card.flowers[2]) {
      addNoti("Too many flowers of some type");
      return false;
    }
    if (ribbonsUsed > 0 && sumQuality - 2 >= card.quality) {
      addNoti("Too many ribbons?");
      return false;
    }
    return true;
  }

  // ── Bot AI Coordination ───────────────────────────────────────────────────
  function handleBotTurn(botId) {
    if (phase === 0 || phase === 3) {
      const cubesNeeded = phase === 0 ? 3 : 2;
      if (players[botId].actionCubes >= cubesNeeded) {
        const bestIdx = findBestIndex(botId, 0);
        executePlayerAction(botId, 0, bestIdx);
      } else {
        executePlayerAction(botId, 0, -1); // pass
      }
    } else if (phase === 2) {
      const shopGoods = shops[activeShop] || [];
      if (shopGoods.length === 0) {
        executePlayerAction(botId, activeShop, -1); // pass
      } else {
        const bestIdx = findBestIndex(botId, activeShop);
        if (!executePlayerAction(botId, activeShop, bestIdx)) {
          executePlayerAction(botId, activeShop, -1);
        }
      }
    }
  }

  function botChooseTimeTokens(botId) {
    const wanted = [];
    const unwanted = [];
    if (turn <= 3) wanted.unshift(5);
    
    if (players[botId].hand.length >= 3 || shops[4].length === 0) {
      unwanted.push(4);
    } else if (players[botId].hand.length <= 1) {
      wanted.unshift(4);
    }

    if (players[botId].hand.length > 0) {
      if (shops[1].length === 0 || players[botId].vases.length === players[botId].numVases) unwanted.push(1);
      else if (needFlowerTokens(botId, 0)) wanted.unshift(1);

      if (shops[2].length === 0 || players[botId].vases.length === players[botId].numVases) unwanted.push(2);
      else if (needFlowerTokens(botId, 1)) wanted.unshift(2);

      if (shops[3].length === 0 || players[botId].vases.length === players[botId].numVases) unwanted.push(3);
      else if (needFlowerTokens(botId, 2)) wanted.unshift(3);
    }

    let totalMoneyInRestaurant = (shops[0] || []).reduce((sum, m) => sum + m, 0);
    if (players[botId].money <= 3 || totalMoneyInRestaurant >= 2 * numPlayers) {
      wanted.unshift(0);
    }

    const middle = [];
    for (let i = 0; i < 6; i++) {
      if (!wanted.includes(i) && !unwanted.includes(i)) middle.push(i);
    }
    shuffle(middle);
    shuffle(unwanted);
    const order = wanted.concat(middle, unwanted);

    const botTokens = getMyTimeTokens(players[botId]);
    players[botId].myPlayedTimeTokens = [];
    for (let i = 0; i < 6; i++) {
      players[botId].myPlayedTimeTokens.push(botTokens[order.indexOf(i)]);
    }

    socket.emit('submit time tokens', {
      id: botId,
      timeTokens: players[botId].myPlayedTimeTokens
    });
  }

  function botArrangeFlower(botId) {
    const player = players[botId];
    if (player.hand.length < 1) return false;

    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      const required = card.flowers;
      const requiredTotal = card.quality;
      const vasesList = [[], [], []];

      player.vases.forEach((tok, index) => {
        vasesList[tok.type].push([index, tok.quality]);
      });

      if (vasesList[0].length >= required[0] && vasesList[1].length >= required[1] && vasesList[2].length >= required[2]) {
        for (let k = 0; k < 3; k++) {
          vasesList[k].sort((a, b) => a[1] - b[1]);
        }

        let totalQuality = getBonus(player, 0);
        const indexFTokens = [];
        for (let k = 0; k < 3; k++) {
          for (let l = 0; l < required[k]; l++) {
            totalQuality += vasesList[k][l][1];
            indexFTokens.push(vasesList[k][l][0]);
          }
        }

        if (totalQuality + 2 * player.numRibbons >= requiredTotal) {
          const numRibbonsUsed = Math.floor((requiredTotal - totalQuality) / 2);
          socket.emit('arrange flower', {
            id: botId,
            card: i,
            indices: indexFTokens,
            ribbons: numRibbonsUsed
          });
          return true;
        }
      }
    }
    return true;
  }

  function needFlowerTokens(botId, type) {
    const player = players[botId];
    if (player.hand.length > 0) {
      const want = player.hand[0].flowers[type];
      const have = player.vases.filter(v => v.type === type).length;
      return want > have;
    }
    return true;
  }

  function findBestIndex(botId, shop) {
    const player = players[botId];
    const shopGoods = shops[shop] || [];
    if (shopGoods.length === 0) return -1;
    let indexBest = 0;

    switch(shop) {
      case 0: // restaurant
        for (let i = 0; i < shopGoods.length; i++) {
          if (shopGoods[i] > shopGoods[indexBest]) indexBest = i;
        }
        break;
      case 1: case 2: case 3: // flower shops
        if (!needFlowerTokens(botId, shop - 1)) {
          indexBest = -1;
        } else {
          for (let i = 0; i < shopGoods.length; i++) {
            if (shopGoods[i].quality > shopGoods[indexBest].quality) indexBest = i;
          }
        }
        break;
      case 4: // library cards
        for (let i = 0; i < shopGoods.length; i++) {
          if (shopGoods[i].quality < shopGoods[indexBest].quality) indexBest = i;
        }
        break;
      case 5: // tools
        if (tieBreak.indexOf(Number(botId)) >= numPlayers - 2) {
          // get tie break priority
          indexBest = 4;
        } else if (player.time <= 2 && player.money >= 5) {
          indexBest = 0;
        } else if ((player.numVases <= 4 || player.numVases === player.vases.length) && player.money >= 4) {
          indexBest = 1;
        } else if (player.numRibbons <= 2 && player.money >= (shopGoods[2] ? shopGoods[2].cost : 0) + 1) {
          indexBest = 2;
        } else {
          indexBest = -1;
        }
        break;
    }
    return indexBest;
  }

  function executePlayerAction(pId, location, index) {
    const res = takeAction(pId, location, index);
    if (res) {
      socket.emit('take action', { id: pId, location, index });
      if (!buyFlowerToolToken) nextPlayer();
    }
    return res;
  }

  function takeAction(pId, location, index) {
    const player = players[pId];
    const shopGoods = shops[location] || [];
    if (location > 0 && location < 6 && shopGoods.length === 0) index = -1;

    if (index === -1) {
      if (turn > 1 || (turn === 1 && phase > 0)) {
        addLog(`${player.username} passes`, pId);
      }
      if (phase === 2) {
        player.actionCubes++;
      }
      buyFlowerToolToken = false;
      return true;
    }

    if (buyFlowerToolToken && (location === 0 || location >= 4)) return false;

    switch(location) {
      case 0: // restaurant
        const coins = shopGoods[index];
        player.money += coins;
        addLog(`${player.username} gains ฿${coins}`, pId);
        if (phase === 2) {
          shops[0].splice(index, 1);
        }
        break;
      case 1: case 2: case 3: // flowers
        if (player.money < 1 && !buyFlowerToolToken) {
          if (pId === myID) addNoti("Not enough money");
          return false;
        }
        if (player.vases.length >= player.numVases) {
          if (pId === myID) addNoti("Vases are full!");
          return false;
        }
        const tok = shopGoods[index];
        player.vases.push({ type: tok.type, quality: tok.quality });
        addLog(`${player.username} buys a ${shopList[location]} flower`, pId);
        shops[location].splice(index, 1);
        if (buyFlowerToolToken) buyFlowerToolToken = false;
        else player.money -= 1;
        break;
      case 4: // library cards
        if (player.hand.length >= handLimit) {
          if (pId === myID) addNoti("Hand is full!");
          return false;
        }
        const card = shopGoods[index];
        player.hand.push({ flowers: card.flowers, quality: card.quality, score: card.score, level: card.level });
        addLog(`${player.username} draws a flower card`, pId);
        shops[4].splice(index, 1);
        break;
      case 5: // tools
        const tool = shopGoods[index];
        if (player.money < tool.cost) {
          if (pId === myID) addNoti("Not enough money");
          return false;
        }
        addLog(`${player.username} buys ${tool.label} for ฿${tool.cost}`, pId);
        // Apply tool upgrades
        switch(tool.type) {
          case 0: // clock
            player.time += tool.amount;
            player.score += tool.amount;
            if (player.time > 6) player.time = 6;
            break;
          case 1: // vase
            if (player.numVases < 6) player.numVases++;
            if (tool.amount === 2 && player.numVases < 6) player.numVases++;
            player.score += tool.amount;
            break;
          case 2: // ribbon
            player.numRibbons += tool.amount;
            break;
          case 3: // buy flower
            buyFlowerToolToken = true;
            if (pId === myID) {
              addNoti("You may buy any leftover flower next!");
            }
            break;
          case 4: // tie break
            goFirst(pId);
            break;
          case 5: // action cubes
            player.actionCubes += tool.amount;
            break;
        }
        player.money -= tool.cost;
        // Level down tool
        tool.level = Math.max(0, tool.level - 1);
        tool.cost = toolCost[tool.type][tool.level];
        tool.amount = toolAmount[tool.type][tool.level];
        tool.label = toolString[tool.type][tool.level];
        break;
      case 6: // achievements
        const achievement = achievements[index];
        if (!checkAchievement(achievement.type, player) || achievement.claimedBy.includes(pId)) return false;
        achievement.claimedBy.push(pId);
        addLog(`${player.username} claimed achievement: ${achievementString[achievement.type]}`, pId);
        const rewards = achievementRewards[achievement.type];
        player.stars[0] += rewards[0];
        player.stars[1] += rewards[1];
        player.stars[2] += rewards[2];
        player.score += rewards[3];
        player.money += rewards[4];
        break;
    }

    if (phase === 0 && location < 6 && !buyFlowerToolToken) player.actionCubes -= 3;
    if (phase === 3 && location < 6 && !buyFlowerToolToken) player.actionCubes -= 2;

    return true;
  }

  // ── Svelte Lifecycle & Sockets ─────────────────────────────────────────────
  onMount(() => {
    socket.on('new game', (data) => {
      initializeBoard(data);
    });

    socket.on('starting stuff recieved', (data) => {
      const bonuses = [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]];
      players.forEach((p, i) => {
        p.bonus = bonuses[data.bonuses[i]];
        p.color = playerColors[i];
      });
      tieBreak = data.tieBreak;

      achievements = data.achieve.map(type => ({
        type,
        claimedBy: []
      }));

      players.forEach((p, i) => {
        // Distribute starting resources
        const orderIdx = tieBreak.indexOf(i);
        p.money = startingMoney + Math.floor(orderIdx / 2);
        p.numRibbons = orderIdx % 2;
        p.time = 0;

        // Draw starting card
        const card = data.flowerCards[i];
        p.hand.push({ flowers: [card[0], card[1], card[2]], quality: card[3], score: card[4], level: card[5] });
      });

      gameLogs = [];
      addLog("***** Turn " + turn + "******");
      currentPlayer = -1;
      nextPlayer();
    });

    socket.on('market generated', (data) => {
      // Goods 0: restaurant
      shops[0] = [...data[0]];
      // Goods 1-3: flowers
      for (let j = 1; j < 4; j++) {
        shops[j] = data[j].map(tok => ({ type: tok[0], quality: tok[1] }));
      }
      // Goods 4: cards
      shops[4] = data[4].map(card => ({ flowers: [card[0], card[1], card[2]], quality: card[3], score: card[4], level: card[5] }));
      // Goods 5: tools
      shops[5] = data[5].map((lvl, idx) => ({
        type: idx,
        level: lvl,
        cost: toolCost[idx][lvl],
        amount: toolAmount[idx][lvl],
        label: toolString[idx][lvl]
      }));
    });

    socket.on('to next phase', (data) => {
      selectedFlowerCardIndex = -1;
      selectedVasesIndices = [];
      chosenRibbons = 0;
      isDone = false;

      switch(data.phase) {
        case 0: // early-bird to planning
          chosenTimeTokens = new Array(6).fill(null);
          phase = 1;
          addLog("----- planning phase -----");
          if (myID === 0) {
            players.forEach(p => {
              if (p.isBot) botChooseTimeTokens(p.id);
            });
          }
          break;
        case 1: // planning to buy
          phase = 2;
          activeShop = 0;
          activeTokenOrder = -1;
          addLog("------ buy phase ------");
          nextPlayer();
          break;
        case 2: // buy to after market
          phase = 3;
          currentPlayer = -1;
          addLog("------ after market phase ------");
          nextPlayer();
          break;
        case 3: // after market to arranging
          phase = 4;
          addLog("------ arranging phase ------");
          if (myID === 0) {
            players.forEach(p => {
              if (p.isBot) {
                botArrangeFlower(p.id);
                socket.emit('finish arranging');
              }
            });
          }
          break;
        case 4: // arranging to early bird
          if (checkEndGame()) {
            gameState = 2; // game end
            let winnerId = 0;
            addLog("------------- Final Scores -------------");
            players.forEach((p, idx) => {
              addLog(`${p.username} : ${p.score}`, idx);
              if (p.score > players[winnerId].score || (p.score === players[winnerId].score && tieBreak.indexOf(idx) < tieBreak.indexOf(winnerId))) {
                winnerId = idx;
              }
            });
            addLog(`|| The winner is ::: ${players[winnerId].username} :::`, winnerId);
          } else {
            turn++;
            phase = 0;
            currentPlayer = -1;
            addLog("***** Turn " + turn + "******");
            addLog("----- early-bird phase -----");
            if (myID === 0) {
              socket.emit('generate market', generateGoods(numPlayers));
            }
            nextPlayer();
          }
          break;
      }
    });

    socket.on('time tokens submitted', (data) => {
      if (players[data.id] && !players[data.id].isBot) {
        addLog(`${players[data.id].username} submitted time tokens`, data.id);
      }
      if (players[data.id]) {
        players[data.id].myPlayedTimeTokens = data.timeTokens;
      }
      numPlayersDone++;
      if (myID === 0 && numPlayersDone >= numPlayers) {
        socket.emit('end phase', { phase: 1 });
        numPlayersDone = 0;
      }
    });

    socket.on('action taken', (data) => {
      takeAction(data.id, data.location, data.index);
      if (!buyFlowerToolToken) nextPlayer();
    });

    socket.on('flower arranged', (data) => {
      const p = players[data.id];
      if (p) {
        const card = p.hand[data.card];
        p.score += getBonus(p, 2) + card.score;
        p.money += getBonus(p, 1);
        p.numPlayedCards += 1;

        card.flowers.forEach((qty, fType) => {
          p.stars[fType] += qty;
        });

        p.numRibbons -= data.ribbons;
        p.hand.splice(data.card, 1);
        data.indices.sort((a, b) => b - a).forEach(idx => p.vases.splice(idx, 1));
        addLog(`${p.username} arranged a bouquet ~`, data.id);
      }
    });

    socket.on('player finished arranging', () => {
      numPlayersDone++;
      if (myID === 0 && numPlayersDone >= numPlayers) {
        socket.emit('end phase', { phase: 4 });
        numPlayersDone = 0;
      }
    });

    socket.on('autoplay toggled', (data) => {
      if (players[data.id]) {
        players[data.id].isBot = data.newStatus;
      }
    });
  });

  // ── Svelte View Controller Functions ───────────────────────────────────────────
  function handleSelectTimeToken(tokenVal) {
    if (phase !== 1 || isDone) return;
    // Find first empty slot in chosenTimeTokens and place it
    const emptyIdx = chosenTimeTokens.indexOf(null);
    if (emptyIdx >= 0) {
      chosenTimeTokens[emptyIdx] = tokenVal;
      chosenTimeTokens = [...chosenTimeTokens];
    }
  }

  function handleRemoveTimeToken(shopIdx) {
    if (phase !== 1 || isDone) return;
    chosenTimeTokens[shopIdx] = null;
    chosenTimeTokens = [...chosenTimeTokens];
  }

  function submitTimePlanning() {
    const filledCount = chosenTimeTokens.filter(t => t !== null).length;
    if (filledCount < 4) {
      addNoti("Assign at least 4 time tokens!");
      return;
    }
    const finalTokens = chosenTimeTokens.map(t => t === null ? 5 : t);
    isDone = true;
    socket.emit('submit time tokens', {
      id: myID,
      timeTokens: finalTokens
    });
  }

  function clickGoods(location, index) {
    if (currentPlayer !== myID) return;
    // Verify eligibility
    if (location === 0 && (activeShop === 0 || phase === 0 || phase === 3)) {
      executePlayerAction(myID, 0, index);
    } else if (location >= 1 && location <= 3 && (activeShop === location || buyFlowerToolToken || phase === 0 || phase === 3)) {
      executePlayerAction(myID, location, index);
    } else if (location === 4 && (activeShop === 4 || phase === 0 || phase === 3)) {
      executePlayerAction(myID, 4, index);
    } else if (location === 5 && (activeShop === 5 || phase === 0 || phase === 3)) {
      executePlayerAction(myID, 5, index);
    }
  }

  function selectVaseToken(index) {
    if (phase !== 4 || isDone) return;
    if (selectedVasesIndices.includes(index)) {
      selectedVasesIndices = selectedVasesIndices.filter(i => i !== index);
    } else {
      selectedVasesIndices = [...selectedVasesIndices, index];
    }
  }

  function selectFlowerCard(index) {
    if (phase !== 4 || isDone) return;
    selectedFlowerCardIndex = selectedFlowerCardIndex === index ? -1 : index;
  }

  function arrangeFlower() {
    if (selectedFlowerCardIndex === -1) {
      addNoti("Select a flower card from hand!");
      return;
    }
    const card = players[myID].hand[selectedFlowerCardIndex];
    const vasesList = selectedVasesIndices.map(idx => players[myID].vases[idx]);
    if (verifyArrangement(card, vasesList, chosenRibbons, getBonus(players[myID], 0))) {
      socket.emit('arrange flower', {
        id: myID,
        card: selectedFlowerCardIndex,
        indices: selectedVasesIndices,
        ribbons: chosenRibbons
      });
      selectedFlowerCardIndex = -1;
      selectedVasesIndices = [];
      chosenRibbons = 0;
      addNoti("Bouquet arranged!");
    }
  }

  function passTurn() {
    if (phase <= 3 && currentPlayer === myID) {
      executePlayerAction(myID, 0, -1);
    } else if (phase === 4) {
      isDone = true;
      socket.emit('finish arranging');
      addNoti("Waiting for other players to finish...");
    }
  }

  function triggerAutoplay() {
    autoplay = !autoplay;
    players[myID].isBot = autoplay;
    socket.emit('toggle autoplay', {
      id: myID,
      newStatus: autoplay
    });
    if (autoplay && currentPlayer === myID) {
      handleBotTurn(myID);
    }
  }
</script>

<svelte:head>
  <title>Pakklong Talat Board Game — SNOWBOARD</title>
</svelte:head>

<GameShell {roomID} gameTitle="pakklongboard">
  <!-- ── Settings slot: game configuration ───────────────────────── -->
  <svelte:fragment slot="settings">
    <div class="form-control max-w-sm mx-auto p-4 bg-base-200/50 rounded-2xl border border-base-300/40 mt-4 flex flex-col gap-4">
      <h3 class="font-bold text-sm text-base-content/80 flex items-center gap-1">
        <span class="material-icons text-sm">settings</span>
        Bots Configuration
      </h3>
      <div class="flex items-center gap-3">
        <label class="label-text font-semibold text-base-content/60 flex-grow" for="bots-select">Bots to add:</label>
        <select id="bots-select" class="select select-bordered select-sm font-medium w-32 focus:select-primary" bind:value={$gameConfigs.numBots}>
          <option value={0}>No bots</option>
          <option value={1}>1 bot</option>
          <option value={2}>2 bots</option>
          <option value={3}>3 bots</option>
          <option value={4}>4 bots</option>
          <option value={5}>5 bots</option>
        </select>
      </div>
    </div>
  </svelte:fragment>

  <!-- ── Canvas slot: main game board area ───────────────────────── -->
  <svelte:fragment slot="canvas">
    {#if gameState > 0 && players.length > 0}
      <div class="flex flex-col gap-6 w-full text-base-content leading-relaxed select-text font-sans">
        
        <!-- Opponents dash area -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {#each players as player, idx}
            {#if idx !== myID}
              <div class="card bg-base-100/70 border border-base-200 p-4 rounded-2xl flex flex-col gap-3 relative overflow-hidden transition-all duration-200 hover:shadow-md">
                <div class="absolute top-0 left-0 w-2 h-full" style="background-color: {player.color}"></div>
                <div class="flex items-center justify-between pl-2">
                  <span class="font-bold text-sm text-base-content/95 flex items-center gap-1">
                    {player.username}
                    {#if player.isBot}
                      <span class="badge badge-xs font-semibold py-1 bg-base-300 text-base-content/50 border-none">BOT</span>
                    {/if}
                  </span>
                  <span class="badge badge-sm font-bold bg-base-200 text-base-content/60 border-base-300">{player.score} pts</span>
                </div>

                <div class="grid grid-cols-4 gap-2 text-center text-xs font-bold text-base-content/75 pl-2">
                  <div class="bg-base-200/50 py-1.5 rounded-xl flex flex-col items-center">
                    <span class="text-[9px] uppercase tracking-wider text-base-content/40 mb-0.5">Money</span>
                    <span class="text-primary font-extrabold text-sm">฿{player.money}</span>
                  </div>
                  <div class="bg-base-200/50 py-1.5 rounded-xl flex flex-col items-center">
                    <span class="text-[9px] uppercase tracking-wider text-base-content/40 mb-0.5">Ribbons</span>
                    <span class="text-secondary font-extrabold text-sm">{player.numRibbons}</span>
                  </div>
                  <div class="bg-base-200/50 py-1.5 rounded-xl flex flex-col items-center">
                    <span class="text-[9px] uppercase tracking-wider text-base-content/40 mb-0.5">Cubes</span>
                    <span class="text-accent font-extrabold text-sm">{player.actionCubes}</span>
                  </div>
                  <div class="bg-base-200/50 py-1.5 rounded-xl flex flex-col items-center">
                    <span class="text-[9px] uppercase tracking-wider text-base-content/40 mb-0.5">Vases</span>
                    <span class="text-success font-extrabold text-sm">{player.vases.length}/{player.numVases}</span>
                  </div>
                </div>

                <!-- Stars arranged bonuses -->
                <div class="flex gap-2 justify-center pl-2 pt-1 border-t border-base-200/60">
                  <div class="badge badge-sm badge-outline border-rose-300/40 text-rose-500 font-bold px-2 py-2 gap-0.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>{player.stars[0]}</span>
                  </div>
                  <div class="badge badge-sm badge-outline border-sky-300/40 text-sky-500 font-bold px-2 py-2 gap-0.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                    <span>{player.stars[1]}</span>
                  </div>
                  <div class="badge badge-sm badge-outline border-slate-300/40 text-base-content/60 font-bold px-2 py-2 gap-0.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-base-300"></span>
                    <span>{player.stars[2]}</span>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Board Game Arena Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <!-- Main shops and marketplace (2 Cols) -->
          <div class="lg:col-span-2 flex flex-col gap-6 bg-base-100 p-6 rounded-3xl border border-base-200/60 shadow-lg relative">
            <h3 class="font-extrabold text-lg flex items-center gap-1.5 text-base-content/95">
              <span class="material-icons text-primary text-xl block">storefront</span>
              Marketplace Bazaar
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {#each shopList as shopName, idx}
                <div class="card bg-base-200/40 border border-base-200 p-4 rounded-2xl flex flex-col justify-between gap-3 relative transition-all duration-200 hover:-translate-y-0.5
                      {phase === 2 && activeShop === idx ? 'ring-2 ring-primary border-primary shadow-lg shadow-primary/5 bg-primary/5' : ''}">
                  
                  <div class="flex items-center justify-between border-b border-base-200/50 pb-2">
                    <span class="font-extrabold text-sm text-base-content/90 flex items-center gap-1.5">
                      <span class="w-2.5 h-2.5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                      {shopName}
                    </span>
                    {#if phase === 2 && activeShop === idx}
                      <span class="badge badge-primary badge-xs py-1.5 font-bold uppercase tracking-wider text-[8px] animate-pulse">ACTIVE</span>
                    {/if}
                  </div>

                  <!-- Shop Goods items list -->
                  <div class="flex-grow flex flex-wrap gap-2 items-center justify-center min-h-[64px]">
                    {#if idx === 0}
                      <!-- Restaurant money -->
                      {#each shops[0] as coins, cIdx}
                        <button class="btn btn-sm btn-primary rounded-xl font-bold px-3 py-1.5 hover:scale-105 active:scale-95" 
                                disabled={currentPlayer !== myID || (phase !== 0 && phase !== 3 && activeShop !== 0)}
                                onclick={() => clickGoods(0, cIdx)}>
                          ฿{coins}
                        </button>
                      {:else}
                        <span class="text-xs text-base-content/40 italic">Empty</span>
                      {/each}
                    {:else if idx >= 1 && idx <= 3}
                      <!-- Flower tokens -->
                      {#each shops[idx] as token, tIdx}
                        <button class="w-10 h-10 rounded-xl border border-base-300 shadow-sm flex flex-col items-center justify-center p-1 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 bg-base-100"
                                disabled={currentPlayer !== myID || (phase !== 0 && phase !== 3 && activeShop !== idx)}
                                onclick={() => clickGoods(idx, tIdx)}
                                style="border-color: {idx === 1 ? 'oklch(var(--p))' : idx === 2 ? 'oklch(var(--s))' : 'oklch(var(--nc))'}">
                          <span class="text-xs font-black tracking-tight"
                                style="color: {idx === 1 ? 'oklch(var(--p))' : idx === 2 ? 'oklch(var(--s))' : 'oklch(var(--nc))'}">
                            Q{token.quality}
                          </span>
                        </button>
                      {:else}
                        <span class="text-xs text-base-content/40 italic">Empty</span>
                      {/each}
                    {:else if idx === 4}
                      <!-- Flower cards -->
                      {#each shops[4] as card, cIdx}
                        <button class="card bg-base-100 border border-base-200 p-2.5 rounded-xl flex flex-col gap-1 items-start cursor-pointer hover:border-primary hover:-translate-y-0.5 active:scale-95 transition-all text-[11px] w-24 text-left shadow-sm relative overflow-hidden"
                                disabled={currentPlayer !== myID || (phase !== 0 && phase !== 3 && activeShop !== 4)}
                                onclick={() => clickGoods(4, cIdx)}>
                          <div class="flex flex-wrap gap-0.5 max-w-full">
                            {#each Array(card.flowers[0]) as _}
                              <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                            {/each}
                            {#each Array(card.flowers[1]) as _}
                              <span class="w-2 h-2 rounded-full bg-sky-500"></span>
                            {/each}
                            {#each Array(card.flowers[2]) as _}
                              <span class="w-2 h-2 rounded-full bg-base-300"></span>
                            {/each}
                          </div>
                          <div class="flex items-center gap-1.5 mt-1 font-bold text-base-content/70">
                            <span class="flex items-center gap-0.5 text-primary">
                              <span class="material-icons text-[10px]">offline_pin</span>
                              Q{card.quality}
                            </span>
                            <span class="flex items-center gap-0.5 text-secondary">
                              <span class="material-icons text-[10px]">emoji_events</span>
                              {card.score}p
                            </span>
                          </div>
                        </button>
                      {:else}
                        <span class="text-xs text-base-content/40 italic">Empty</span>
                      {/each}
                    {:else if idx === 5}
                      <!-- Tool shop -->
                      {#each shops[5] as tool, tIdx}
                        {#if tool.level > 0}
                          <button class="card bg-base-100 border border-base-200 p-2 rounded-xl flex flex-col gap-1 items-center cursor-pointer hover:border-primary hover:scale-[1.03] active:scale-95 transition-all text-center w-28 shadow-sm"
                                  disabled={currentPlayer !== myID || (phase !== 0 && phase !== 3 && activeShop !== 5)}
                                  onclick={() => clickGoods(5, tIdx)}>
                            <span class="text-[10px] font-extrabold uppercase tracking-wide text-primary">LV{tool.level}</span>
                            <span class="text-[10px] font-bold text-base-content/75 truncate max-w-full leading-tight">{tool.label}</span>
                            <span class="badge badge-secondary badge-xs font-black py-2 mt-1">฿{tool.cost}</span>
                          </button>
                        {/if}
                      {/each}
                    {/if}
                  </div>

                  <!-- Planning tokens dropped (Phase 2 time tokens) -->
                  {#if phase === 2 && timeTokensByShop[idx] && timeTokensByShop[idx].length > 0}
                    <div class="flex gap-1.5 justify-center flex-wrap pt-2 border-t border-base-200/50 mt-1">
                      {#each timeTokensByShop[idx] as token}
                        <div class="badge badge-sm font-bold text-[10px] px-2.5 py-2.5 text-white shadow-sm flex gap-1 rounded-lg"
                             style="background-color: {players[token.id].color}">
                          <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                          <span>{timeTokenList[token.value]}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <!-- Planning slots clickable (Phase 1) -->
                  {#if phase === 1}
                    <div class="pt-2 border-t border-base-200/50 mt-1 flex justify-center">
                      {#if chosenTimeTokens[idx] !== null}
                        <button class="badge badge-md font-bold text-white shadow-sm flex gap-1.5 rounded-xl cursor-pointer hover:badge-error transition-all duration-200 py-3"
                                style="background-color: {players[myID].color}"
                                onclick={() => handleRemoveTimeToken(idx)}>
                          <span>{timeTokenList[chosenTimeTokens[idx]]}</span>
                          <span class="material-icons text-xs">close</span>
                        </button>
                      {:else}
                        <div class="text-[10px] font-bold text-base-content/40 tracking-wider py-1 uppercase border border-dashed border-base-300 rounded-xl w-full text-center">
                          Drop Token
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Achievements, log activity and personal details (1 Col) -->
          <div class="lg:col-span-1 flex flex-col gap-6">
            <!-- Achievements panel -->
            <div class="bg-base-100 p-5 rounded-3xl border border-base-200/60 shadow-lg flex flex-col gap-4">
              <h3 class="font-extrabold text-sm flex items-center gap-1.5 text-base-content/95 border-b border-base-200/50 pb-2">
                <span class="material-icons text-warning text-xl">star</span>
                Achievements goals
              </h3>
              <div class="grid grid-cols-2 gap-3">
                {#each achievements as achievement, idx}
                  <button class="card border border-base-200/60 p-3 rounded-2xl flex flex-col items-center justify-between text-center gap-2 cursor-pointer transition-all duration-200 hover:border-primary active:scale-95 shadow-sm
                          {(phase === 0 || phase === 3) && checkAchievement(achievement.type, players[myID]) && !achievement.claimedBy.includes(myID) ? 'ring-2 ring-warning bg-warning/5 border-warning animate-pulse' : ''}"
                          disabled={currentPlayer !== myID || (phase !== 0 && phase !== 3)}
                          onclick={() => clickGoods(6, idx)}>
                    <span class="text-[10px] font-bold text-base-content/75 leading-tight">{achievementString[achievement.type]}</span>
                    {#if achievement.claimedBy.length > 0}
                      <div class="flex gap-1 flex-wrap justify-center mt-1">
                        {#each achievement.claimedBy as claimId}
                          <div class="w-3.5 h-3.5 rounded-full border border-white/40 shadow-inner" style="background-color: {players[claimId].color}"></div>
                        {/each}
                      </div>
                    {:else}
                      <span class="badge badge-ghost badge-xs py-1.5 font-bold uppercase tracking-wider text-[8px]">Unclaimed</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Visual Game Activity Terminal -->
            <div class="bg-base-100 rounded-3xl border border-base-200/60 shadow-lg flex flex-col overflow-hidden h-60">
              <div class="px-5 py-3 border-b border-base-200/60 bg-base-200/30 flex items-center justify-between">
                <h3 class="font-mono text-xs font-bold uppercase tracking-wider text-base-content/60">Game log console</h3>
                <div class="w-2 h-2 rounded-full bg-success animate-pulse"></div>
              </div>
              <div class="flex-grow p-4 overflow-y-auto font-mono text-[10px] leading-relaxed flex flex-col gap-1.5 bg-base-200/10">
                {#each gameLogs as log}
                  <div class="flex gap-1.5 items-start px-2 py-1 rounded border border-base-200/40" style="background-color: {log.color}; color: {log.textColor}">
                    <span class="opacity-40 select-none">[{log.timestamp}]</span>
                    <span>{log.msg}</span>
                  </div>
                {:else}
                  <div class="text-base-content/40 italic text-center py-12">Console is ready. Let's start the match!</div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- Personal Player Board dashboard -->
        <div class="bg-base-100 p-6 rounded-3xl border border-base-200/60 shadow-lg mt-4 flex flex-col gap-6 relative">
          <div class="absolute top-0 left-0 w-full h-2 rounded-t-3xl" style="background-color: {players[myID].color}"></div>
          
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-base-200 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md"
                   style="background-color: {players[myID].color}">
                {players[myID].username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 class="font-black text-md text-base-content/95 flex items-center gap-1.5">
                  {players[myID].username}
                  <span class="text-xs text-primary font-bold">(You)</span>
                </h4>
                <div class="flex items-center gap-1 text-[10px] font-bold text-base-content/40 tracking-widest uppercase">
                  <span>Planning track:</span>
                  <span class="badge badge-ghost badge-xs font-black text-primary py-1.5">LV{players[myID].time}</span>
                </div>
              </div>
            </div>

            <!-- Controls panel: Pass & Submit actions -->
            <div class="flex items-center gap-3">
              <!-- Autoplay toggle -->
              <button class="btn btn-sm font-bold gap-1 rounded-xl transition-all duration-200
                      {autoplay ? 'btn-success text-white shadow-md' : 'btn-outline border-base-300 hover:bg-base-200'}"
                      onclick={triggerAutoplay}>
                <span class="material-icons text-sm">{autoplay ? 'smart_toy' : 'play_arrow'}</span>
                <span>{autoplay ? 'Autoplay: ON' : 'Autoplay'}</span>
              </button>

              {#if phase === 1 && !isDone}
                <button class="btn btn-sm btn-primary gap-1 shadow-md rounded-xl hover:scale-105" onclick={submitTimePlanning}>
                  <span class="material-icons text-sm">done_all</span>
                  Submit Planning
                </button>
              {/if}

              {#if phase === 4 && !isDone && selectedFlowerCardIndex !== -1}
                <button class="btn btn-sm btn-primary gap-1 shadow-md rounded-xl hover:scale-105" onclick={arrangeFlower}>
                  <span class="material-icons text-sm">florist</span>
                  Arrange Bouquet
                </button>
              {/if}

              {#if (phase === 0 || phase === 2 || phase === 3 || phase === 4) && !isDone && currentPlayer === myID}
                <button class="btn btn-sm btn-error btn-outline gap-1 rounded-xl hover:scale-105" onclick={passTurn}>
                  <span class="material-icons text-sm">forward</span>
                  Pass / End Turn
                </button>
              {/if}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            <!-- Vases & Flower tokens area (5 Cols) -->
            <div class="md:col-span-5 flex flex-col gap-3">
              <h5 class="font-extrabold text-xs text-base-content/65 uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-icons text-sm text-primary">local_florist</span>
                Fresh flower vases
              </h5>
              
              <div class="grid grid-cols-6 gap-3 bg-base-200/35 border border-base-200 p-4 rounded-2xl min-h-[96px] items-center justify-center text-center">
                {#each Array(players[myID].numVases) as _, idx}
                  {@const token = players[myID].vases[idx]}
                  {#if token}
                    <button class="aspect-square rounded-2xl border flex flex-col items-center justify-center p-1.5 cursor-pointer shadow-sm transition-all duration-150 hover:scale-110 active:scale-95 bg-base-100
                            {selectedVasesIndices.includes(idx) ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}"
                            style="border-color: {token.type === 0 ? 'oklch(var(--p))' : token.type === 1 ? 'oklch(var(--s))' : 'oklch(var(--nc))'}"
                            onclick={() => selectVaseToken(idx)}>
                      <span class="text-xs font-black tracking-tight"
                            style="color: {token.type === 0 ? 'oklch(var(--p))' : token.type === 1 ? 'oklch(var(--s))' : 'oklch(var(--nc))'}">
                        Q{token.quality}
                      </span>
                    </button>
                  {:else}
                    <div class="aspect-square rounded-2xl border border-dashed border-base-300 flex items-center justify-center text-base-content/20 bg-base-100/30">
                      <span class="material-icons text-md">filter_vintage</span>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>

            <!-- Flower cards hand (5 Cols) -->
            <div class="md:col-span-5 flex flex-col gap-3">
              <h5 class="font-extrabold text-xs text-base-content/65 uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-icons text-sm text-primary">portrait</span>
                Bouquet orders (Hand)
              </h5>
              
              <div class="flex gap-3 bg-base-200/35 border border-base-200 p-4 rounded-2xl min-h-[96px] overflow-x-auto items-center">
                {#each players[myID].hand as card, idx}
                  <button class="card bg-base-100 border p-3 rounded-2xl flex flex-col gap-1 items-start cursor-pointer hover:border-primary hover:-translate-y-0.5 active:scale-95 transition-all text-xs w-28 text-left shadow-sm relative overflow-hidden flex-shrink-0
                          {selectedFlowerCardIndex === idx ? 'ring-2 ring-primary border-primary shadow-lg shadow-primary/5 bg-primary/5' : 'border-base-200'}"
                          onclick={() => selectFlowerCard(idx)}>
                    <div class="flex flex-wrap gap-0.5 max-w-full">
                      {#each Array(card.flowers[0]) as _}
                        <span class="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white/20 shadow-inner"></span>
                      {/each}
                      {#each Array(card.flowers[1]) as _}
                        <span class="w-2.5 h-2.5 rounded-full bg-sky-500 border border-white/20 shadow-inner"></span>
                      {/each}
                      {#each Array(card.flowers[2]) as _}
                        <span class="w-2.5 h-2.5 rounded-full bg-base-300 border border-white/20 shadow-inner"></span>
                      {/each}
                    </div>
                    <div class="flex items-center gap-2 mt-2 font-black text-base-content/70">
                      <span class="flex items-center gap-0.5 text-primary">
                        <span class="material-icons text-xs">offline_pin</span>
                        Q{card.quality}
                      </span>
                      <span class="flex items-center gap-0.5 text-secondary">
                        <span class="material-icons text-xs">emoji_events</span>
                        {card.score}p
                      </span>
                    </div>
                  </button>
                {:else}
                  <div class="flex-grow text-center text-xs text-base-content/40 italic">No bouquet orders in hand. Draw some cards from the Bookstore!</div>
                {/each}
              </div>
            </div>

            <!-- Time Planning token pool (2 Cols) -->
            {#if phase === 1}
              <div class="md:col-span-2 flex flex-col gap-3">
                <h5 class="font-extrabold text-xs text-base-content/65 uppercase tracking-wider flex items-center gap-1.5">
                  <span class="material-icons text-sm text-primary">hourglass_empty</span>
                  Tokens pool
                </h5>
                <div class="flex gap-2 flex-wrap bg-base-200/35 border border-base-200 p-3 rounded-2xl min-h-[96px] justify-center items-center">
                  {#each getMyTimeTokens(players[myID]) as tokenVal}
                    {#if !chosenTimeTokens.includes(tokenVal)}
                      <button class="badge badge-md font-bold text-white shadow-sm flex items-center justify-center rounded-xl cursor-pointer hover:scale-110 active:scale-95 transition-all py-3 px-3.5"
                              style="background-color: {players[myID].color}"
                              onclick={() => handleSelectTimeToken(tokenVal)}>
                        {timeTokenList[tokenVal]}
                      </button>
                    {/if}
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Ribbon arrangement selector (2 Cols) -->
            {#if phase === 4 && selectedFlowerCardIndex !== -1}
              <div class="md:col-span-2 flex flex-col gap-3">
                <h5 class="font-extrabold text-xs text-base-content/65 uppercase tracking-wider flex items-center gap-1.5">
                  <span class="material-icons text-sm text-primary">bookmark</span>
                  Add ribbons
                </h5>
                <div class="flex flex-col gap-2 bg-base-200/35 border border-base-200 p-3 rounded-2xl min-h-[96px] justify-center items-stretch">
                  <select class="select select-bordered select-sm w-full font-bold focus:select-primary" bind:value={chosenRibbons}>
                    {#each Array(players[myID].numRibbons + 1) as _, i}
                      <option value={i}>{i} ribbons (+{2 * i}Q)</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center py-20 text-center gap-3">
        <span class="loading loading-ring loading-lg text-primary"></span>
        <span class="text-xs text-base-content/50 font-medium">Acquiring game room state data...</span>
      </div>
    {/if}
  </svelte:fragment>
</GameShell>
