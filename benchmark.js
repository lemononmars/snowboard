const { performance } = require('perf_hooks');

const NUM_PLAYERS = 1000;
const ITERATIONS = 10000;

const playerInfo = {
  usernames: {},
  scores: {},
  actions: {}
};

const answers = {};
const correctAnswer = 1;

for (let i = 0; i < NUM_PLAYERS; i++) {
  const id = `player_${i}`;
  playerInfo.usernames[id] = `User ${i}`;
  playerInfo.scores[id] = 0;

  if (i % 2 === 0) {
    playerInfo.actions[id] = { action: 1, time: i * 100 };
    answers[id] = playerInfo.actions[id];
  } else if (i % 3 === 0) {
    playerInfo.actions[id] = { action: 2, time: i * 100 };
    answers[id] = playerInfo.actions[id];
  }
}

function computeScoreForIn() {
  var correctPlayers = []
  var penalty = 0;
  for (const id in playerInfo.usernames){
    if(id in answers){
      if (answers[id].action === correctAnswer)
        correctPlayers.push([id, answers[id].time])
      else {
        penalty = 10*(penalty++)
      }
    }
  }
  return correctPlayers.length;
}

function computeScoreObjectKeys() {
  var correctPlayers = []
  var penalty = 0;
  for (const id of Object.keys(playerInfo.usernames)){
    if(id in answers){
      if (answers[id].action === correctAnswer)
        correctPlayers.push([id, answers[id].time])
      else {
        penalty = 10*(penalty++)
      }
    }
  }
  return correctPlayers.length;
}

// Warmup
for (let i = 0; i < 1000; i++) {
  computeScoreForIn();
  computeScoreObjectKeys();
}

const startForIn = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  computeScoreForIn();
}
const endForIn = performance.now();

const startObjectKeys = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  computeScoreObjectKeys();
}
const endObjectKeys = performance.now();

console.log(`for...in took: ${endForIn - startForIn} ms`);
console.log(`for...of Object.keys() took: ${endObjectKeys - startObjectKeys} ms`);
