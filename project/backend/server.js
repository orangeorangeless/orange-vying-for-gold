import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const API_BASE_URL = (process.env.API_BASE_URL || "https://api.chatanywhere.tech").replace(/\/$/, "");
const API_KEY = process.env.API_KEY || "";
const MODEL = process.env.MODEL || "gpt-3.5-turbo";

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(express.json({ limit: "1mb" }));

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      // file:// 或部分本地工具 origin 为 null
      if (!origin || origin === "null") {
        callback(null, true);
        return;
      }
      if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // 本地常见地址变体（localhost / 127.0.0.1 混用）仍允许跨域
      if (isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);

const GAME_RULES = `你是「四角抢金币」游戏的智能助手。游戏规则摘要：
- 9x9 棋盘，四名玩家按颜色区分：红方、蓝方、绿方、紫方，每轮在四角随机出生。
- 每轮生成 4 个金币格（5-40 金币），距四角起点曼哈顿距离 > 2。
- 玩家用方向键选择目标金币（上=A、左=B、下=C、右=D）；金币编号规则：最上方（并列取最左）为 A，再逆时针 B/C/D。
- 全员选完后同步一格一格移动；仅最先到达者吃到金币；同一步两人及以上同时到达则该格作废。
- 得分 = 吃到金额 - 移动步数，未吃到则 0 - 步数。共 100 轮。
请用简洁中文回答，可结合用户提供的当前对局状态给策略建议。`;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasApiKey: Boolean(API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, gameContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages 不能为空" });
      return;
    }
    if (!API_KEY) {
      res.status(503).json({ error: "服务端未配置 API_KEY，请在 backend/.env 中设置" });
      return;
    }

    const systemParts = [GAME_RULES];
    if (gameContext) {
      systemParts.push(`当前对局状态（JSON）：\n${JSON.stringify(gameContext, null, 2)}`);
    }

    const upstreamMessages = [
      { role: "system", content: systemParts.join("\n\n") },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ];

    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: upstreamMessages,
        temperature: 0.7,
      }),
    });

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error("上游非 JSON 响应:", raw.slice(0, 500));
      res.status(502).json({
        error: "上游 API 返回了非 JSON，请检查 API_KEY、API_BASE_URL 或网络",
      });
      return;
    }
    if (!response.ok) {
      const msg = data?.error?.message || data?.message || `上游 API 错误 ${response.status}`;
      res.status(response.status).json({ error: msg });
      return;
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "（无回复内容）";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// 可选：同一进程托管前端静态文件（部署时也可用 Nginx 单独托管 frontend）
const frontendDir = path.join(__dirname, "../frontend");
app.use(express.static(frontendDir));

app.listen(PORT, () => {
  console.log(`服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`前端页面: http://0.0.0.0:${PORT}/index.html`);
  console.log(`聊天接口: POST http://0.0.0.0:${PORT}/api/chat`);
});
