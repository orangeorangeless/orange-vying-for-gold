(function initChatWidget() {
  const config = window.APP_CONFIG || {};
  const apiBase = (config.chatApiBase || "http://127.0.0.1:8080").replace(/\/$/, "");

  const fab = document.getElementById("chatFab");
  const panel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("chatClose");
  const messagesEl = document.getElementById("chatMessages");
  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");

  if (!fab || !panel || !messagesEl || !inputEl || !sendBtn) return;

  const history = [];
  let backendReady = false;

  function apiUrl(path) {
    return `${apiBase}${path}`;
  }

  function appendMessage(role, text) {
    const el = document.createElement("div");
    el.className = `chat-msg ${role}`;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function getGameContext() {
    if (typeof window.getGameContextForChat === "function") {
      return window.getGameContextForChat();
    }
    return null;
  }

  async function checkBackend() {
    try {
      const res = await fetch(apiUrl("/api/health"), { method: "GET" });
      const data = await res.json();
      backendReady = res.ok && data.ok;
      if (!backendReady) {
        appendMessage("error", "后端未就绪，请先运行 启动本地.bat");
        return false;
      }
      if (!data.hasApiKey) {
        appendMessage("error", "后端未配置 API_KEY，请编辑 backend/.env");
        return false;
      }
      return true;
    } catch {
      backendReady = false;
      appendMessage(
        "error",
        `未连上后端 ${apiBase} 。请双击 project/启动本地.bat，等黑窗口出现「服务已启动」后，用浏览器打开 http://127.0.0.1:8080（不要双击 html，也不要用 Live Server 占 8080 端口）。`,
      );
      return false;
    }
  }

  const FAB_MARGIN = 20;
  const DRAG_THRESHOLD = 4;
  const FAB_STORE_KEY = "chatFabPos";
  let fabState = null;
  let dragged = false;

  function moveFab(x, y) {
    const maxX = Math.max(window.innerWidth - fab.offsetWidth - FAB_MARGIN, FAB_MARGIN);
    const maxY = Math.max(window.innerHeight - fab.offsetHeight - FAB_MARGIN, FAB_MARGIN);
    fab.style.right = "auto";
    fab.style.bottom = "auto";
    fab.style.left = `${Math.min(Math.max(x, FAB_MARGIN), maxX)}px`;
    fab.style.top = `${Math.min(Math.max(y, FAB_MARGIN), maxY)}px`;
  }

  function applyFab(onLeft, top) {
    moveFab(onLeft ? FAB_MARGIN : window.innerWidth - fab.offsetWidth - FAB_MARGIN, top);
    panel.classList.toggle("on-left", onLeft);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(FAB_STORE_KEY) || "null");
    if (saved && typeof saved.top === "number") {
      fabState = { onLeft: Boolean(saved.onLeft), top: saved.top };
      applyFab(fabState.onLeft, fabState.top);
    }
  } catch {
    // 存储不可用时保持默认位置
  }

  fab.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    const grabX = e.clientX - rect.left;
    const grabY = e.clientY - rect.top;
    dragged = false;
    fab.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      if (!dragged && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < DRAG_THRESHOLD) {
        return;
      }
      dragged = true;
      fab.classList.add("dragging");
      moveFab(ev.clientX - grabX, ev.clientY - grabY);
    };

    const onUp = () => {
      fab.removeEventListener("pointermove", onMove);
      fab.removeEventListener("pointerup", onUp);
      fab.removeEventListener("pointercancel", onUp);
      fab.classList.remove("dragging");
      if (!dragged) return;
      const box = fab.getBoundingClientRect();
      fabState = { onLeft: box.left + box.width / 2 < window.innerWidth / 2, top: box.top };
      applyFab(fabState.onLeft, fabState.top);
      try {
        localStorage.setItem(FAB_STORE_KEY, JSON.stringify(fabState));
      } catch {
        // 存储不可用时仅本次生效
      }
    };

    fab.addEventListener("pointermove", onMove);
    fab.addEventListener("pointerup", onUp);
    fab.addEventListener("pointercancel", onUp);
  });

  window.addEventListener("resize", () => {
    if (fabState) applyFab(fabState.onLeft, fabState.top);
  });

  fab.addEventListener("click", () => {
    if (dragged) {
      dragged = false;
      return;
    }
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      inputEl.focus();
    }
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    if (!backendReady) {
      const ok = await checkBackend();
      if (!ok) return;
    }

    inputEl.value = "";
    sendBtn.disabled = true;
    appendMessage("user", text);
    history.push({ role: "user", content: text });

    const loadingEl = appendMessage("assistant", "思考中…");

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          gameContext: getGameContext(),
        }),
      });

      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        const hint = rawText.trim().slice(0, 120);
        data = {
          error: hint
            ? `后端返回了非 JSON（${res.status}）：${hint}`
            : `后端返回了非 JSON（${res.status}），多为 CORS 被拒或 8080 端口不是 Node 服务。请用 启动本地.bat 打开 http://127.0.0.1:8080`,
        };
      }

      loadingEl.remove();

      if (!res.ok) {
        appendMessage("error", data.error || `请求失败 (${res.status})`);
        return;
      }

      const reply = data.reply || "（无回复）";
      appendMessage("assistant", reply);
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      loadingEl.remove();
      appendMessage(
        "error",
        `无法连接 ${apiUrl("/api/chat")} 。请确认已运行 node server.js，且浏览器地址是 http://127.0.0.1:8080`,
      );
      console.error("chat fetch failed:", err);
      backendReady = false;
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  appendMessage("assistant", "你好，我是游戏助手。正在检查后端连接…");
  void checkBackend().then((ok) => {
    if (ok) {
      const last = messagesEl.lastElementChild;
      if (last) last.textContent = "你好，我是游戏助手。可以问我规则、选格策略或当前局面分析。";
    }
  });
})();
