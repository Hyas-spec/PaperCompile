@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   题衡 PaperCompile - 本地演示启动
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm。
  echo 请先安装 Node.js LTS：https://nodejs.org/
  echo 安装后重新打开命令行，执行 node -v 和 npm -v 确认。
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/2] 首次启动，安装依赖...
  call npm install
  if errorlevel 1 (
    echo.
    echo [错误] npm install 失败，请检查网络或 npm registry 配置。
    pause
    exit /b 1
  )
) else (
  echo [1/2] 已存在 node_modules，跳过安装。
)

echo.
echo [2/2] 启动开发服务器并自动打开浏览器...
echo 页面地址：http://localhost:5173/
echo 关闭本窗口或按 Ctrl+C 可停止服务。
echo.
call npm run dev -- --open
pause
