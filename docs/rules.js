// 示意棋盘用 7×7（对局是 9×9），格子太小时金额和角标会糊。
const N = 7;

const BOARD_CORNERS = [
  { x: 0, y: 0 },
  { x: N - 1, y: 0 },
  { x: 0, y: N - 1 },
  { x: N - 1, y: N - 1 },
];

// 第 3 页按键对照用固定四格，A/B/C/D 位置稳定好认。
const COINS = [
  { letter: "A", x: 4, y: 1, amount: 32 },
  { letter: "B", x: 1, y: 3, amount: 28 },
  { letter: "C", x: 3, y: 5, amount: 24 },
  { letter: "D", x: 6, y: 3, amount: 8 },
];

const PLAYERS = [
  { className: "p1", name: "红方" },
  { className: "p2", name: "蓝方" },
  { className: "p3", name: "绿方" },
  { className: "p4", name: "紫方" },
];

const STEP_MS = 420;

const pct = (v) => `${((v + 0.5) / N) * 100}%`;

// 和正式对局同一套锚点：同格多人错开一点，圆圈能叠但不能完全挡住。
function getAnchorsForCount(count) {
  if (count <= 1) return [{ x: 50, y: 50 }];
  if (count === 2) return [{ x: 34, y: 50 }, { x: 66, y: 50 }];
  if (count === 3) return [{ x: 34, y: 34 }, { x: 66, y: 34 }, { x: 50, y: 66 }];
  return [
    { x: 34, y: 34 },
    { x: 66, y: 34 },
    { x: 34, y: 66 },
    { x: 66, y: 66 },
  ];
}

function offsetTokens(tokens, positions) {
  const groups = new Map();
  positions.forEach((pos, i) => {
    const key = `${pos.x},${pos.y}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  groups.forEach((idxs) => {
    const anchors = getAnchorsForCount(idxs.length);
    idxs.forEach((i, n) => {
      const pos = positions[i];
      const a = anchors[n];
      tokens[i].style.left = `${((pos.x + a.x / 100) / N) * 100}%`;
      tokens[i].style.top = `${((pos.y + a.y / 100) / N) * 100}%`;
      tokens[i].classList.toggle("crowded", idxs.length > 1);
    });
  });
}

function scoreChip(s) {
  const sign = s.score >= 0 ? "+" : "−";
  const yes = s.gain > 0;
  return `<span class="demo-chip is-eq is-sum"><span class="chip-who"><span class="dot ${s.className}"></span>${s.name}</span><span class="score-ate ${yes ? "is-yes" : "is-no"}" data-ate>${yes ? "吃到金币！" : "未吃到金币"}</span><span class="chip-formula"><span class="f-pos">${s.gain}</span><span class="f-eq">−</span><span class="f-neg">${s.steps}</span><span class="f-eq" data-eq>=</span><span class="f-sum" data-sum>${sign}${Math.abs(s.score)}</span></span></span>`;
}

function shortestPath(start, target) {
  const path = [];
  let cx = start.x;
  let cy = start.y;
  while (cx !== target.x || cy !== target.y) {
    if (cx < target.x) cx += 1;
    else if (cx > target.x) cx -= 1;
    else if (cy < target.y) cy += 1;
    else if (cy > target.y) cy -= 1;
    path.push({ x: cx, y: cy });
  }
  return path;
}

// 与对局同样的判定：同一步只有单人到达才算吃到，两人及以上则该格作废，
// 已经有归属的格子后来者无效。
function resolveRound(players, coins) {
  const find = (letter) => coins.find((c) => c.letter === letter);
  const paths = players.map((p) => shortestPath(p.start, find(p.pick)));
  const maxSteps = Math.max(...paths.map((p) => p.length));
  const outcome = new Map();

  for (let step = 1; step <= maxSteps; step += 1) {
    const arrivals = new Map();
    players.forEach((player, i) => {
      const pos = paths[i][step - 1];
      if (!pos) return;
      const coin = find(player.pick);
      if (pos.x !== coin.x || pos.y !== coin.y) return;
      if (!arrivals.has(player.pick)) arrivals.set(player.pick, []);
      arrivals.get(player.pick).push(i);
    });
    arrivals.forEach((who, letter) => {
      if (outcome.has(letter)) return;
      outcome.set(letter, who.length === 1 ? { winner: who[0], step } : { blocked: true, step });
    });
  }

  const scores = players.map((player, i) => {
    const result = outcome.get(player.pick);
    const coin = find(player.pick);
    const gain = result && result.winner === i ? coin.amount : 0;
    const steps = paths[i].length;
    return { name: player.name, className: player.className, gain, steps, score: gain - steps };
  });

  return { players, coins, paths, maxSteps, outcome, scores };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildDemoRound() {
  const corners = shuffled(BOARD_CORNERS);
  const open = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (corners.some((c) => manhattan({ x, y }, c) <= 2)) continue;
      open.push({ x, y });
    }
  }
  const used = new Set();
  const take = (ok) => {
    const opts = shuffled(open.filter((p) => ok(p) && !used.has(`${p.x},${p.y}`)));
    const p = opts[0] || shuffled(open.filter((q) => !used.has(`${q.x},${q.y}`)))[0];
    used.add(`${p.x},${p.y}`);
    return p;
  };
  // 上 A、左 B、下 C、右 D，和方向键一致；位置仍随机，但四个方向各抽一格，逆时针一眼能看出来。
  const coins = [
    { ...take((p) => p.y <= 2), letter: "A", amount: randomInt(5, 40) },
    { ...take((p) => p.x <= 2 && p.y === 3), letter: "B", amount: randomInt(5, 40) },
    { ...take((p) => p.y >= 4), letter: "C", amount: randomInt(5, 40) },
    { ...take((p) => p.x >= 4 && p.y === 3), letter: "D", amount: randomInt(5, 40) },
  ];
  const players = PLAYERS.map((p, i) => ({
    ...p,
    start: { ...corners[i] },
    pick: "ABCD"[randomInt(0, 3)],
  }));
  return resolveRound(players, coins);
}

function coinMarkup(coin) {
  return `<span class="coin-tag">${coin.letter}</span><span class="coin-amount">${coin.amount}<span class="coin-icon" aria-hidden="true"></span></span>`;
}

function buildGrid(container) {
  const cells = [];
  for (let i = 0; i < N * N; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cells[i] = cell;
    container.appendChild(cell);
  }
  return cells;
}

/* ---------- 演示引擎：第 1 页，讲流程 ---------- */

function createDemo({ boardId, tokensId, stepsId }) {
  const boardEl = document.getElementById(boardId);
  const tokensEl = document.getElementById(tokensId);
  const stepsEl = document.getElementById(stepsId);
  if (!boardEl || !tokensEl || !stepsEl) return null;

  const cells = buildGrid(boardEl);
  const steps = Array.from(stepsEl.children);
  const timers = [];
  let round = buildDemoRound();

  const tokens = PLAYERS.map((player) => {
    const el = document.createElement("div");
    el.className = `player ${player.className}`;
    el.innerHTML = `<span class="demo-pick"></span>`;
    tokensEl.appendChild(el);
    return el;
  });

  function at(ms, fn) {
    timers.push(window.setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers.length = 0;
  }

  function light(n) {
    steps.forEach((li, i) => li.classList.toggle("is-on", i === n));
  }

  function applyRound() {
    tokens.forEach((el, i) => {
      el.querySelector(".demo-pick").textContent = round.players[i].pick;
    });
  }

  function placeTokens(step) {
    offsetTokens(tokens, round.players.map((player, i) => {
      const path = round.paths[i];
      return step === 0 ? player.start : path[Math.min(step, path.length) - 1];
    }));
  }

  function dropCoins() {
    round.coins.forEach((coin) => {
      const el = document.createElement("div");
      el.className = "coin";
      el.innerHTML = coinMarkup(coin);
      cells[coin.y * N + coin.x].appendChild(el);
    });
  }

  function settleAt(step) {
    round.outcome.forEach((result, letter) => {
      if (result.step !== step) return;
      const coin = round.coins.find((c) => c.letter === letter);
      const cell = cells[coin.y * N + coin.x];
      cell.querySelector(".coin")?.classList.add("claimed");
      if (result.blocked) return;
      const spark = document.createElement("div");
      spark.className = "spark";
      cell.appendChild(spark);
      at(1000, () => spark.remove());
    });
  }

  function reset() {
    cells.forEach((cell) => cell.querySelectorAll(".coin, .spark").forEach((el) => el.remove()));
    steps.forEach((li) => li.classList.remove("is-on"));
    tokens.forEach((el) => el.classList.remove("has-pick"));
    tokensEl.classList.remove("is-live");
    applyRound();
    placeTokens(0);
  }

  function runMovement(startAt) {
    for (let step = 1; step <= round.maxSteps; step += 1) {
      at(startAt + step * STEP_MS, () => {
        placeTokens(step);
        settleAt(step);
      });
    }
    return startAt + round.maxSteps * STEP_MS;
  }

  function play() {
    clearTimers();
    round = buildDemoRound();
    reset();
    at(300, () => {
      light(0);
      tokensEl.classList.add("is-live");
    });
    at(1700, () => {
      light(1);
      dropCoins();
    });
    at(3300, () => light(2));
    tokens.forEach((el, i) => at(3300 + i * 170, () => el.classList.add("has-pick")));
    at(5100, () => light(3));
    at(runMovement(5100) + 2200, play);
  }

  return {
    start() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        round = buildDemoRound();
        reset();
        dropCoins();
        tokensEl.classList.add("is-live");
        tokens.forEach((el) => el.classList.add("has-pick"));
        round.outcome.forEach((_, letter) => {
          const coin = round.coins.find((c) => c.letter === letter);
          cells[coin.y * N + coin.x].querySelector(".coin")?.classList.add("claimed");
        });
        placeTokens(round.maxSteps);
        steps.forEach((li) => li.classList.add("is-on"));
        return;
      }
      play();
    },
    stop() {
      clearTimers();
      reset();
    },
  };
}

/* ---------- 第 2 页：两个独立小例子，红绿争同一格 ----------
   每轮从四角随机抽两个作为出生点（和真对局一样），金币位置按两人距离现算：
   近红方 → 红先到独得；等距 → 同时到达作废。同一轮两次例子共用出生角，好对比。
*/

const RED = { className: "p1", name: "红方" };
const GREEN = { className: "p3", name: "绿方" };

function isCorner(p) {
  return BOARD_CORNERS.some((c) => c.x === p.x && c.y === p.y);
}

function pickTwoCorners() {
  const i = randomInt(0, 3);
  let j = randomInt(0, 2);
  if (j >= i) j += 1;
  return [BOARD_CORNERS[i], BOARD_CORNERS[j]];
}

function scanBoard(test) {
  const out = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const p = { x, y };
      if (isCorner(p)) continue;
      if (test(p)) out.push(p);
    }
  }
  return out;
}

function pickCell(cells) {
  return { ...cells[randomInt(0, cells.length - 1)] };
}

function buildJudgeScenes() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [redStart, greenStart] = pickTwoCorners();
    const closer = scanBoard((p) => {
      const dr = manhattan(p, redStart);
      const dg = manhattan(p, greenStart);
      return dr >= 2 && dg > dr;
    });
    const equal = scanBoard((p) => {
      const d = manhattan(p, redStart);
      return d >= 2 && d === manhattan(p, greenStart);
    });
    if (!closer.length || !equal.length) continue;
    const players = [
      { ...RED, start: { ...redStart }, pick: "A" },
      { ...GREEN, start: { ...greenStart }, pick: "A" },
    ];
    return [
      resolveRound(players, [{ letter: "A", ...pickCell(closer), amount: 32 }]),
      resolveRound(players, [{ letter: "A", ...pickCell(equal), amount: 32 }]),
    ];
  }
  const players = [
    { ...RED, start: { x: 0, y: 0 }, pick: "A" },
    { ...GREEN, start: { x: N - 1, y: 0 }, pick: "A" },
  ];
  return [
    resolveRound(players, [{ letter: "A", x: 1, y: 2, amount: 32 }]),
    resolveRound(players, [{ letter: "A", x: 3, y: 2, amount: 32 }]),
  ];
}

function createJudgeDemo() {
  const boardEl = document.getElementById("judgeBoard");
  const tokensEl = document.getElementById("judgeTokens");
  const stepsEl = document.getElementById("judgeSteps");
  const resultEls = Array.from(document.querySelectorAll("[data-judge-result]"));
  if (!boardEl || !tokensEl || !stepsEl || resultEls.length < 2) return null;

  const cells = buildGrid(boardEl);
  const steps = Array.from(stepsEl.children);
  const timers = [];
  let scenes = buildJudgeScenes();
  let scene = scenes[0];

  const tokens = [RED, GREEN].map((player) => {
    const el = document.createElement("div");
    el.className = `player ${player.className}`;
    el.innerHTML = `<span class="demo-pick">A</span>`;
    tokensEl.appendChild(el);
    return el;
  });

  function liveChip(s) {
    const sign = s.score >= 0 ? "+" : "−";
    const yes = s.gain > 0;
    return `<span class="demo-chip"><span class="chip-who"><span class="dot ${s.className}"></span>${s.name}</span><span class="score-ate ${yes ? "is-yes" : "is-no"}" data-ate>${yes ? "吃到金币！" : "未吃到金币"}</span><span class="chip-formula"><span class="f-pos" data-gain>0</span><span class="f-eq">−</span><span class="f-neg" data-steps>0</span><span class="f-eq" data-eq>=</span><span class="f-sum" data-sum>${sign}${Math.abs(s.score)}</span></span></span>`;
  }

  function mountLive(index) {
    resultEls[index].innerHTML = scenes[index].scores.map(liveChip).join("");
  }

  function mountAll() {
    resultEls.forEach((el, i) => {
      el.innerHTML = scenes[i].scores.map(liveChip).join("");
    });
  }

  function chipsOf(index) {
    return Array.from(resultEls[index].querySelectorAll(".demo-chip"));
  }

  function at(ms, fn) {
    timers.push(window.setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers.length = 0;
  }

  function placeTokens(step) {
    offsetTokens(tokens, scene.players.map((player, i) => {
      const path = scene.paths[i];
      return step === 0 ? player.start : path[Math.min(step, path.length) - 1];
    }));
  }

  function dropCoin() {
    scene.coins.forEach((coin) => {
      const el = document.createElement("div");
      el.className = "coin is-set";
      el.innerHTML = coinMarkup(coin);
      cells[coin.y * N + coin.x].appendChild(el);
    });
  }

  function settleAt(step, panelIndex) {
    scene.outcome.forEach((result, letter) => {
      if (result.step !== step) return;
      const coin = scene.coins.find((c) => c.letter === letter);
      const cell = cells[coin.y * N + coin.x];
      cell.querySelector(".coin")?.classList.add("claimed");
      if (result.blocked) return;
      const spark = document.createElement("div");
      spark.className = "spark";
      cell.appendChild(spark);
      at(1000, () => spark.remove());
      const gainEl = chipsOf(panelIndex)[result.winner]?.querySelector("[data-gain]");
      if (!gainEl) return;
      gainEl.classList.add("is-pop");
      const ticks = 8;
      for (let i = 1; i <= ticks; i += 1) {
        at((360 * i) / ticks, () => {
          gainEl.textContent = String(Math.round((coin.amount * i) / ticks));
        });
      }
    });
  }

  function clearBoard() {
    cells.forEach((cell) => cell.querySelectorAll(".coin, .spark").forEach((el) => el.remove()));
    tokens.forEach((el) => el.classList.remove("has-pick"));
    tokensEl.classList.remove("is-live");
  }

  function playScene(index) {
    resultEls.forEach((el) => el.classList.remove("is-on"));
    if (index === 0) {
      scenes = buildJudgeScenes();
      mountAll();
    } else {
      mountLive(index);
    }
    scene = scenes[index];
    clearBoard();
    steps.forEach((li, i) => li.classList.toggle("is-on", i === index));
    placeTokens(0);
    resultEls[index].classList.add("is-on");

    at(200, () => {
      tokensEl.classList.add("is-live");
      tokens.forEach((el) => el.classList.add("has-pick"));
      dropCoin();
    });

    const moveStart = 700;
    for (let step = 1; step <= scene.maxSteps; step += 1) {
      at(moveStart + step * STEP_MS, () => {
        placeTokens(step);
        chipsOf(index).forEach((chip, i) => {
          chip.querySelector("[data-steps]").textContent = String(Math.min(step, scene.paths[i].length));
        });
        settleAt(step, index);
      });
    }

    const moveEnd = moveStart + scene.maxSteps * STEP_MS;
    at(moveEnd + 500, () => {
      chipsOf(index).forEach((chip) => chip.classList.add("is-eq"));
    });
    at(moveEnd + 1100, () => {
      chipsOf(index).forEach((chip) => chip.classList.add("is-sum"));
    });
    at(moveEnd + 2600, () => playScene((index + 1) % scenes.length));
  }

  function play() {
    clearTimers();
    resultEls.forEach((el) => el.classList.remove("is-on"));
    playScene(0);
  }

  return {
    start() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        clearTimers();
        scene = scenes[0];
        clearBoard();
        dropCoin();
        tokensEl.classList.add("is-live");
        tokens.forEach((el) => el.classList.add("has-pick"));
        scene.outcome.forEach((_, letter) => {
          const coin = scene.coins.find((c) => c.letter === letter);
          cells[coin.y * N + coin.x].querySelector(".coin")?.classList.add("claimed");
        });
        placeTokens(scene.maxSteps);
        steps.forEach((li) => li.classList.add("is-on"));
        resultEls.forEach((el, i) => {
          el.innerHTML = scenes[i].scores.map(scoreChip).join("");
          el.classList.add("is-on");
        });
        return;
      }
      play();
    },
    stop() {
      clearTimers();
      clearBoard();
      steps.forEach((li) => li.classList.remove("is-on"));
      resultEls.forEach((el) => el.classList.remove("is-on"));
      scene = scenes[0];
      placeTokens(0);
    },
  };
}

/* ---------- 第 3 页：四个金币格各自对应四人的同一方向键 ---------- */

function createMapDemo() {
  const boardEl = document.getElementById("mapBoard");
  const tokensEl = document.getElementById("mapTokens");
  const keys = Array.from(document.querySelectorAll("[data-map-key]"));
  if (!boardEl || !tokensEl || keys.length === 0) return null;

  const cells = buildGrid(boardEl);
  const coinEls = COINS.map((coin) => {
    const el = document.createElement("div");
    el.className = "coin is-set";
    el.innerHTML = coinMarkup(coin);
    cells[coin.y * N + coin.x].appendChild(el);
    return el;
  });

  [
    { className: "p1", name: "红方", start: { x: 0, y: 0 } },
    { className: "p2", name: "蓝方", start: { x: N - 1, y: 0 } },
    { className: "p3", name: "绿方", start: { x: 0, y: N - 1 } },
    { className: "p4", name: "紫方", start: { x: N - 1, y: N - 1 } },
  ].forEach((player) => {
    const el = document.createElement("div");
    el.className = `player ${player.className}`;
    el.title = player.name;
    el.style.left = pct(player.start.x);
    el.style.top = pct(player.start.y);
    tokensEl.appendChild(el);
  });
  tokensEl.classList.add("is-live");

  const letters = COINS.map((c) => c.letter);
  let index = 0;
  let timer = 0;

  function show(i) {
    index = i;
    const letter = letters[i];
    coinEls.forEach((el, n) => {
      const on = COINS[n].letter === letter;
      el.classList.toggle("is-focus", on);
      el.classList.toggle("is-dim", !on);
    });
    keys.forEach((key) => {
      const on = key.dataset.mapKey === letter;
      key.classList.toggle("is-focus", on);
      key.classList.toggle("is-dim", !on);
    });
  }

  function clearFocus() {
    coinEls.forEach((el) => el.classList.remove("is-focus", "is-dim"));
    keys.forEach((key) => key.classList.remove("is-focus", "is-dim"));
  }

  return {
    start() {
      show(0);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      window.clearInterval(timer);
      timer = window.setInterval(() => show((index + 1) % letters.length), 1800);
    },
    stop() {
      window.clearInterval(timer);
      timer = 0;
      clearFocus();
    },
  };
}

/* ---------- 翻页 ---------- */

function setupCarousel() {
  const track = document.getElementById("track");
  const slides = Array.from(document.querySelectorAll("[data-slide]"));
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsEl = document.getElementById("dots");
  const startBtn = document.getElementById("startBtn");
  const noteEl = document.getElementById("rulesNote");
  const params = new URLSearchParams(window.location.search);
  const fromGame = params.get("from") === "game";
  const embed = params.has("embed");
  const lastIndex = slides.length - 1;

  // 下标与页序一一对应，没有演示的页放 null
  const demos = [
    createDemo({ boardId: "demoBoard", tokensId: "demoTokens", stepsId: "demoSteps" }),
    createJudgeDemo(),
    createMapDemo(),
  ];

  if (params.has("reset")) {
    // 上线前反复测试首次进入流程用：清掉「已看过规则」标记
    try {
      localStorage.removeItem("rulesSeen");
    } catch {
      // 存储不可用时本来也不会留下标记
    }
  }

  const dots = slides.map(() => {
    const dot = document.createElement("span");
    dotsEl.appendChild(dot);
    return dot;
  });

  let unlocked = false;
  let index = 0;

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    startBtn.disabled = false;
    if (!fromGame) noteEl.textContent = "可以开始了，也可以往回翻再看看";
  }

  // 演示只在自己那一页且标签页可见时跑，避免离开后定时器空转
  function syncDemos() {
    demos.forEach((demo, i) => {
      if (!demo) return;
      if (i === index && !document.hidden) demo.start();
      else demo.stop();
    });
  }

  function show(next) {
    index = Math.min(Math.max(next, 0), lastIndex);
    track.style.setProperty("--i", String(index));
    slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== index)));
    dots.forEach((dot, i) => dot.classList.toggle("on", i === index));
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === lastIndex;
    if (index === lastIndex) unlock();
    syncDemos();
  }

  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  document.addEventListener("visibilitychange", syncDemos);

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });

  if (embed) document.body.classList.add("rules-embed");

  if (fromGame) {
    // 从对局中新标签页打开，页面内没有可返回的入口，关掉标签页即可
    startBtn.classList.add("hidden");
    noteEl.textContent = "看完关闭本标签页即可，对局进度不会丢失。";
  } else {
    startBtn.addEventListener("click", () => {
      try {
        localStorage.setItem("rulesSeen", "1");
      } catch {
        // 存储不可用时下次仍会看到规则页，不影响进入游戏
      }
      window.location.replace("index.html");
    });
  }

  show(0);
}

setupCarousel();
