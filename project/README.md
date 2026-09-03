# 四角抢金币 + AI 助手

```
project/
  frontend/   # 游戏页面 + 右下角聊天气泡
  backend/    # 联网 AI 接口（API Key 仅保存在服务器）
```

## 本地开发

### 1. 后端

```bash
cd project/backend
cp .env.example .env
# 编辑 .env，填入 API_KEY（ChatAnywhere 的 sk- 密钥，见 backend/.env.example）
npm install
npm start
```

浏览器访问：`http://localhost:8080`（后端会同时托管 frontend 静态文件）

生产访问：`http://121.5.162.62:8080`

### 2. 仅前端（Live Server 等）

若前端单独开在其它端口，`frontend/config.js` 会请求 `http://127.0.0.1:8080`；请确保 `.env` 的 `CORS_ORIGINS` 包含你的前端地址。

## 上线到 GitHub（源码 + 可访问网址）

GitHub **仓库**只保存代码。要让别人打开网页，还要用 **GitHub Pages** 托管 `project/frontend`。AI 聊天需要 Node 后端和 API 密钥，Pages 跑不了，所以后端放到 **Render**（免费 HTTPS）。

### 1. 把代码推到 GitHub

本机需已安装 [Git](https://git-scm.com/download/win) 和 [GitHub CLI](https://cli.github.com/)，并执行过 `gh auth login`。

```bash
cd g:\vying_for_gold
git init -b main
git add .
git status   # 确认没有 backend/.env
git commit -m "Publish four-corner gold game"
gh repo create orange-vying-for-gold --public --source=. --remote=origin --push
```

不要提交 `project/backend/.env`（里面有 API 密钥）。

### 2. 用 GitHub Pages 发布游戏页

仓库里的 `docs/` 就是游戏页面。在 GitHub 打开该仓库：

1. **Settings → Pages → Build and deployment → Source** 选 **Deploy from a branch**
2. Branch 选 **main**，文件夹选 **/docs**，保存
3. 一两分钟后公开地址为：  
   `https://orangeorangeless.github.io/orange-vying-for-gold/`

### 3. 把后端部署到 Render（HTTPS）

1. 打开 [Render](https://render.com)，用 GitHub 登录，**New → Blueprint**，选中这个仓库（根目录有 `render.yaml`）。
2. 填写环境变量（不要写进 Git）：
   - `API_KEY`：ChatAnywhere 的 `sk-` 密钥
   - `CORS_ORIGINS`：`https://orangeorangeless.github.io`（只要域名，不要加仓库路径）
3. 部署完成后会得到类似 `https://vying-for-gold-api.onrender.com` 的地址。
4. 把 `project/frontend/config.js` 里的 `PROD_CHAT_API_BASE` 改成这个地址，再 `git add` / `commit` / `push`。

浏览器打开 Pages 地址，右下角 AI 应能对话。若聊天失败，先打开 `https://你的-render地址/api/health`，确认 `"hasApiKey": true`。

## 服务器部署（简要）

1. 将 `project` 目录上传到服务器（**不要上传 `.env`**）。
2. 在服务器 `backend` 目录创建 `.env` 并填写 `API_KEY`。
3. `npm install && npm start`（建议用 **pm2** 守护进程）。
4. 用 **Nginx**：
   - `/` → `frontend` 静态目录，或反代到 Node `3001`
   - `/api/` → 反代到 `http://127.0.0.1:8080/api/`
5. 生产环境将 `frontend/config.js` 中 `chatApiBase` 设为 `""`（与网站同域）。

## 接口

- `GET /api/health` — 健康检查
- `POST /api/chat` —  body: `{ "messages": [{ "role":"user","content":"..." }], "gameContext": {} }`

## 安全说明

- **切勿**把 API 密钥写进前端代码或 Git。
- **切勿**在聊天/仓库中提交服务器 root 密码；请使用 SSH 密钥并定期改密。
