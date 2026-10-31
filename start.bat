@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo 首次运行，正在安装依赖（约 1-2 分钟）...
  call npm install --no-audit --no-fund
)
echo 正在启动 Flag Football Pass 开发服务器...
start "" http://localhost:5173
call npm run dev
