@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
if not exist ".env" (
  echo [提示] 未找到 .env，正在从 .env.example 复制...
  copy /Y ".env.example" ".env" >nul
  echo 请编辑 backend\.env 填入 API_KEY 后重新运行本脚本。
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo 正在安装依赖...
  call npm install
)
echo.
echo ========================================
echo   本地地址: http://127.0.0.1:8080
echo   请勿双击 html，必须用上面这个地址打开
echo ========================================
echo.
echo 若 8080 已被占用，请先关闭占用该端口的程序（如 Live Server）。
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8080"
node server.js
pause
