const { performance } = require('perf_hooks');

function benchForIn(pinfo) {
    let start = performance.now();
    for (let j = 0; j < 100000; j++) {
        var items = [];
        for (var id in pinfo.usernames) {
            items.push([0, pinfo.usernames[id], pinfo.scores[id]]);
        }
    }
    return performance.now() - start;
}

function benchObjKeys(pinfo) {
    let start = performance.now();
    for (let j = 0; j < 100000; j++) {
        var items = [];
        for (const id of Object.keys(pinfo.usernames)) {
            items.push([0, pinfo.usernames[id], pinfo.scores[id]]);
        }
    }
    return performance.now() - start;
}

const sizes = [10, 100, 1000];

for (const size of sizes) {
    console.log(`\nTesting with size: ${size}`);
    const pinfo = { usernames: {}, scores: {} };
    for (let i = 0; i < size; i++) {
        const id = 'user' + i;
        pinfo.usernames[id] = 'User' + i;
        pinfo.scores[id] = Math.random() * 1000;
    }

    // Warmup
    benchForIn(pinfo);
    benchObjKeys(pinfo);

    const forInTime = benchForIn(pinfo);
    const objKeysTime = benchObjKeys(pinfo);

    console.log(`for...in: ${forInTime.toFixed(2)} ms`);
    console.log(`Object.keys: ${objKeysTime.toFixed(2)} ms`);
    console.log(`Improvement: ${((forInTime - objKeysTime) / forInTime * 100).toFixed(2)}%`);
}
