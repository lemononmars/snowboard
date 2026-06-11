import { performance } from 'perf_hooks';

// Mock room class and method
class Room {
  constructor(gameTitle, id) {
    this.gameTitle = gameTitle;
    this.public = true;
    this.players = {
      p1: { data: { username: "player1" } },
      p2: { data: { username: "player2" } },
      p3: { data: { username: "player3" } },
    };
    this.hostUserID = "p1";
    this.roomID = id;
    this.status = 1;
  }

  roomInfo() {
    return {
      gameTitle: this.gameTitle,
      public: this.public,
      players: Object.entries(this.players).map(([k,v]) => v.data.username),
      hostUserID: this.hostUserID,
      roomID: this.roomID,
      status: this.status
    }
  }
}

// Generate mock data
const rooms = {};
for (let i = 0; i < 10000; i++) {
  const title = i % 10 === 0 ? 'targetTitle' : `title${i % 10}`;
  rooms[`room_${i}`] = new Room(title, `room_${i}`);
}

const targetTitle = 'targetTitle';

function filterMap() {
  return Object.entries(rooms)
    .filter(([k, v]) => v.gameTitle === targetTitle)
    .map(([k, v]) => [k, v.roomInfo()]);
}

function mapFilter() {
  return Object.entries(rooms)
    .map(([k, v]) => [k, v.roomInfo()])
    .filter(([k, v]) => v.gameTitle === targetTitle);
}

// Warmup
for (let i = 0; i < 100; i++) {
  filterMap();
  mapFilter();
}

const iterations = 1000;

const startMapFilter = performance.now();
for (let i = 0; i < iterations; i++) {
  mapFilter();
}
const endMapFilter = performance.now();

const startFilterMap = performance.now();
for (let i = 0; i < iterations; i++) {
  filterMap();
}
const endFilterMap = performance.now();

console.log(`map then filter (baseline): ${endMapFilter - startMapFilter} ms`);
console.log(`filter then map (optimized): ${endFilterMap - startFilterMap} ms`);
