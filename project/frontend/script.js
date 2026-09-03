const BOARD_SIZE = 9;
const TOTAL_ROUNDS = 100;
const MIN_SAFE_DISTANCE = 2;
const STEP_DELAY_MS = 280;
const CORNERS = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 0, y: 8 },
  { x: 8, y: 8 },
];

// 金币 A/B/C/D 依次对应上/左/下/右，与四人的方向键一致
const COIN_LETTERS = ["A", "B", "C", "D"];

const PLAYER_CONFIG = [
  { id: 1, name: "红方", className: "p1", start: { x: 0, y: 0 }, keys: ["w", "a", "s", "d"] },
  { id: 2, name: "蓝方", className: "p2", start: { x: 8, y: 0 }, keys: ["i", "j", "k", "l"] },
  { id: 3, name: "绿方", className: "p3", start: { x: 0, y: 8 }, keys: ["t", "f", "g", "h"] },
  { id: 4, name: "紫方", className: "p4", start: { x: 8, y: 8 }, keys: ["arrowup", "arrowleft", "arrowdown", "arrowright"] },
];

const state = {
  round: 1,
  phase: "selection",
  players: [],
  coins: [],
  coinIdByLabel: [],
  selectedByPlayer: new Map(),
};

const boardEl = document.getElementById("board");
const roundTextEl = document.getElementById("roundText");
const selectionSectionEl = document.getElementById("selectionSection");
const scoreboardSectionEl = document.getElementById("scoreboardSection");
const scoreRowsEl = document.getElementById("scoreRows");
const continueBtnEl = document.getElementById("continueBtn");
const endSectionEl = document.getElementById("endSection");

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function createPlayers() {
  return PLAYER_CONFIG.map((cfg) => ({
    ...cfg,
    pos: { ...cfg.start },
    totalScore: 0,
    path: [],
    movedSteps: 0,
    ateCoin: false,
  }));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignRandomCorners() {
  const randomCorners = shuffled(CORNERS);
  state.players.forEach((player, idx) => {
    player.start = { ...randomCorners[idx] };
    player.pos = { ...randomCorners[idx] };
  });
}

function isFarEnoughFromAllStarts(pos) {
  return state.players.every((p) => manhattanDistance(pos, p.start) > MIN_SAFE_DISTANCE);
}

function generateCoins() {
  const used = new Set();
  const coins = [];

  while (coins.length < 4) {
    const x = randomInt(0, BOARD_SIZE - 1);
    const y = randomInt(0, BOARD_SIZE - 1);
    const key = `${x},${y}`;
    if (used.has(key)) continue;
    if (!isFarEnoughFromAllStarts({ x, y })) continue;
    used.add(key);
    coins.push({
      id: coins.length,
      x,
      y,
      amount: randomInt(5, 40),
      claimedBy: null,
      blocked: false,
    });
  }

  return coins;
}

function assignCoinLabelsForRound() {
  if (state.coins.length !== 4) return;

  const center = state.coins.reduce(
    (acc, coin) => ({ x: acc.x + coin.x / 4, y: acc.y + coin.y / 4 }),
    { x: 0, y: 0 },
  );

  const startCoin = [...state.coins].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  })[0];

  const startAngle = Math.atan2(-(startCoin.y - center.y), startCoin.x - center.x);

  const ccwOrdered = [...state.coins]
    .map((coin) => {
      const angle = Math.atan2(-(coin.y - center.y), coin.x - center.x);
      const delta = (angle - startAngle + Math.PI * 2) % (Math.PI * 2);
      return { coin, delta };
    })
    .sort((a, b) => {
      if (a.delta !== b.delta) return a.delta - b.delta;
      if (a.coin.y !== b.coin.y) return a.coin.y - b.coin.y;
      return a.coin.x - b.coin.x;
    })
    .map((entry) => entry.coin);

  state.coinIdByLabel = [];
  ccwOrdered.forEach((coin, idx) => {
    coin.label = idx + 1;
    state.coinIdByLabel[idx] = coin.id;
  });
}

function cellId(x, y) {
  return `cell-${x}-${y}`;
}

function getCell(x, y) {
  return document.getElementById(cellId(x, y));
}

function drawBoard() {
  boardEl.innerHTML = "";
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.id = cellId(x, y);
      boardEl.appendChild(cell);
    }
  }
}

function drawCoins() {
  state.coins.forEach((coin) => {
    const cell = getCell(coin.x, coin.y);
    if (!cell) return;
    const coinEl = document.createElement("div");
    coinEl.className = `coin ${coin.claimedBy || coin.blocked ? "claimed" : ""}`;
    coinEl.dataset.coinId = String(coin.id);
    coinEl.innerHTML = `<span class="coin-tag">${COIN_LETTERS[coin.label - 1]}</span><span class="coin-amount">${coin.amount}<span class="coin-icon" aria-hidden="true"></span></span>`;
    cell.appendChild(coinEl);
  });
}

function clearDynamicLayers() {
  document.querySelectorAll(".coin, .player").forEach((el) => el.remove());
}

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

function drawPlayers() {
  const playersByCell = new Map();
  state.players.forEach((player) => {
    const key = `${player.pos.x},${player.pos.y}`;
    if (!playersByCell.has(key)) {
      playersByCell.set(key, []);
    }
    playersByCell.get(key).push(player);
  });

  playersByCell.forEach((playersInCell) => {
    const anchors = getAnchorsForCount(playersInCell.length);
    playersInCell.forEach((player, idx) => {
      const cell = getCell(player.pos.x, player.pos.y);
      if (!cell) return;
      const pEl = document.createElement("div");
      pEl.className = `player ${player.className}${playersInCell.length > 1 ? " crowded" : ""}`;
      pEl.title = player.name;
      pEl.setAttribute("aria-label", player.name);
      pEl.style.left = `${anchors[idx].x}%`;
      pEl.style.top = `${anchors[idx].y}%`;
      pEl.style.transform = "translate(-50%, -50%)";
      cell.appendChild(pEl);
    });
  });
}

function render() {
  clearDynamicLayers();
  drawCoins();
  drawPlayers();
  roundTextEl.textContent = `第 ${state.round} / ${TOTAL_ROUNDS} 轮`;
  renderSelectionStatus();
}

function renderSelectionStatus() {
  state.players.forEach((player) => {
    const statusEl = document.getElementById(`status-p${player.id}`);
    if (!statusEl) return;
    const selectedCoinId = state.selectedByPlayer.get(player.id);
    if (selectedCoinId === undefined) {
      statusEl.className = "status-wait";
      statusEl.textContent = "未选择";
    } else {
      statusEl.className = "status-done";
      statusEl.textContent = "已选择";
    }
  });
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

function prepareRoundMovement() {
  state.players.forEach((player) => {
    const coinId = state.selectedByPlayer.get(player.id);
    const targetCoin = state.coins[coinId];
    player.path = shortestPath(player.pos, { x: targetCoin.x, y: targetCoin.y });
    player.movedSteps = 0;
    player.ateCoin = false;
  });
}

function triggerSparkAt(x, y) {
  const cell = getCell(x, y);
  if (!cell) return;
  const spark = document.createElement("div");
  spark.className = "spark";
  cell.appendChild(spark);
  window.setTimeout(() => {
    spark.remove();
  }, 1000);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runMovementPhase() {
  state.phase = "moving";
  prepareRoundMovement();
  const maxSteps = Math.max(...state.players.map((p) => p.path.length));

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    const arrivalsByCoin = new Map();

    state.players.forEach((player) => {
      const next = player.path[stepIndex];
      if (!next) return;
      player.pos = { ...next };
      player.movedSteps += 1;
      const chosenCoinId = state.selectedByPlayer.get(player.id);
      const coin = state.coins[chosenCoinId];

      if (!player.ateCoin && player.pos.x === coin.x && player.pos.y === coin.y) {
        if (!arrivalsByCoin.has(chosenCoinId)) {
          arrivalsByCoin.set(chosenCoinId, []);
        }
        arrivalsByCoin.get(chosenCoinId).push(player);
      }
    });

    arrivalsByCoin.forEach((arrivals, coinId) => {
      const coin = state.coins[coinId];
      if (!coin || coin.claimedBy !== null || coin.blocked) return;

      if (arrivals.length === 1) {
        const winner = arrivals[0];
        coin.claimedBy = winner.id;
        winner.ateCoin = true;
        triggerSparkAt(coin.x, coin.y);
        return;
      }

      // Tie on the earliest arrival step: nobody gets this coin.
      coin.blocked = true;
    });

    render();
    await sleep(STEP_DELAY_MS);
  }
}

function settleRound() {
  const rows = [];
  state.players.forEach((player) => {
    const chosenCoin = state.coins[state.selectedByPlayer.get(player.id)];
    const gain = chosenCoin.claimedBy === player.id ? chosenCoin.amount : 0;
    const roundScore = gain - player.movedSteps;
    player.totalScore += roundScore;
    rows.push({
      playerId: player.id,
      className: player.className,
      name: player.name,
      roundScore,
      totalScore: player.totalScore,
      ate: chosenCoin.claimedBy === player.id,
    });
  });
  rows.sort((a, b) => a.playerId - b.playerId);
  return rows;
}

function renderScoreboard(rows) {
  scoreRowsEl.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = `score-row${row.ate ? " ate" : ""}`;
    const round = `${row.roundScore >= 0 ? "+" : ""}${row.roundScore}`;
    item.innerHTML = `
      <span class="score-player">
        <span class="score-who"><span class="dot ${row.className}"></span>${row.name}</span>
        <span class="score-ate ${row.ate ? "is-yes" : "is-no"}">${row.ate ? "吃到金币！" : "未吃到金币"}</span>
      </span>
      <span class="score-num">
        <small>本轮得分</small>
        <b>${round}</b>
      </span>
      <span class="score-num">
        <small>累计得分</small>
        <b>${row.totalScore}</b>
      </span>
    `;
    scoreRowsEl.appendChild(item);
  });
}

async function finishRoundAndShowScore() {
  state.phase = "settlement";
  const rows = settleRound();
  render();
  selectionSectionEl.classList.add("hidden");
  scoreboardSectionEl.classList.remove("hidden");
  renderScoreboard(rows);
}

function resetSelectionForNewRound() {
  state.selectedByPlayer.clear();
  assignRandomCorners();
  state.coins = generateCoins();
  assignCoinLabelsForRound();
  document.querySelectorAll(".spark").forEach((el) => el.remove());
  state.players.forEach((p) => {
    p.pos = { ...p.start };
    p.path = [];
    p.movedSteps = 0;
    p.ateCoin = false;
  });
}

function startRound() {
  state.phase = "selection";
  resetSelectionForNewRound();
  selectionSectionEl.classList.remove("hidden");
  scoreboardSectionEl.classList.add("hidden");
  render();
}

async function tryStartMovementWhenAllSelected() {
  if (state.selectedByPlayer.size !== state.players.length) return;
  await runMovementPhase();
  await finishRoundAndShowScore();
}

function handleKeySelect(key) {
  if (state.phase !== "selection") return;
  const lower = key.toLowerCase();
  const player = state.players.find(
    (p) => p.keys.includes(lower) && !state.selectedByPlayer.has(p.id),
  );
  if (!player) return;

  const coinIndex = player.keys.indexOf(lower);
  if (coinIndex < 0 || coinIndex > 3) return;

  const coinId = state.coinIdByLabel[coinIndex];
  if (coinId === undefined) return;

  state.selectedByPlayer.set(player.id, coinId);
  renderSelectionStatus();
  void tryStartMovementWhenAllSelected();
}

function handleContinue() {
  if (state.round >= TOTAL_ROUNDS) {
    scoreboardSectionEl.classList.add("hidden");
    selectionSectionEl.classList.add("hidden");
    endSectionEl.classList.remove("hidden");
    state.phase = "ended";
    return;
  }
  state.round += 1;
  startRound();
}

function init() {
  state.players = createPlayers();
  drawBoard();
  startRound();

  window.addEventListener("keydown", (e) => {
    if (document.getElementById("rulesModal")?.open) return;
    handleKeySelect(e.key);
  });

  continueBtnEl.addEventListener("click", handleContinue);
  setupRulesModal();
}

function setupRulesModal() {
  const link = document.getElementById("rulesLink");
  const modal = document.getElementById("rulesModal");
  const frame = document.getElementById("rulesFrame");
  const closeBtn = document.getElementById("rulesModalClose");
  if (!link || !modal || !frame || !closeBtn) return;

  function openRules() {
    frame.src = "rules.html?embed=1&v=live21";
    setTimeout(() => modal.showModal(), 0);
  }

  link.addEventListener("click", () => {
    openRules();
  });
  closeBtn.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
  modal.addEventListener("close", () => {
    frame.src = "about:blank";
  });
  frame.addEventListener("load", () => {
    if (!modal.open) return;
    frame.contentWindow?.focus();
  });
}

window.getGameContextForChat = function getGameContextForChat() {
  return {
    round: state.round,
    phase: state.phase,
    totalRounds: TOTAL_ROUNDS,
    players: state.players.map((p) => ({
      name: p.name,
      totalScore: p.totalScore,
      position: { ...p.pos },
    })),
    coins: state.coins.map((c) => ({
      label: COIN_LETTERS[c.label - 1],
      amount: c.amount,
      position: { x: c.x, y: c.y },
      claimedBy: c.claimedBy,
      blocked: c.blocked,
    })),
  };
};

init();
