function updateScoreboardForIn(pinfo){
    var items = []
    for (var id in pinfo.usernames)
        items.push([0, pinfo.usernames[id], pinfo.scores[id]])
    return items;
}

function updateScoreboardObjKeys(pinfo){
    var items = []
    for (const id of Object.keys(pinfo.usernames))
        items.push([0, pinfo.usernames[id], pinfo.scores[id]])
    return items;
}

const pinfo = {
    usernames: {},
    scores: {}
};

for (let i = 0; i < 1000; i++) {
    const id = 'user' + i;
    pinfo.usernames[id] = 'UserName' + i;
    pinfo.scores[id] = Math.random() * 1000;
}

const numRuns = 100000;

let start1 = performance.now();
for(let i=0; i<numRuns; i++) {
    updateScoreboardForIn(pinfo);
}
let end1 = performance.now();
console.log("for...in time:", end1 - start1, "ms");

let start2 = performance.now();
for(let i=0; i<numRuns; i++) {
    updateScoreboardObjKeys(pinfo);
}
let end2 = performance.now();
console.log("Object.keys time:", end2 - start2, "ms");

let start3 = performance.now();
for(let i=0; i<numRuns; i++) {
    updateScoreboardForIn(pinfo);
}
let end3 = performance.now();
console.log("for...in time:", end3 - start3, "ms");

let start4 = performance.now();
for(let i=0; i<numRuns; i++) {
    updateScoreboardObjKeys(pinfo);
}
let end4 = performance.now();
console.log("Object.keys time:", end4 - start4, "ms");
