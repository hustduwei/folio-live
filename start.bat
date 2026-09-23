@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

if /I "%~1"=="open" goto waitopen

where node >nul 2>&1
if errorlevel 1 goto nonode

if not exist "node_modules\" (
  echo 第一次打开，正在下载依赖，请等一两分钟...
  call npm install
  if errorlevel 1 goto fail
)

echo.
echo 正在启动持仓全景图。
echo 请不要关闭这个黑色窗口。关掉它，页面就会停。
echo 准备好后浏览器会自动打开 http://localhost:43147
echo.

start "open-portfolio" /MIN cmd /c ""%~f0" open"
call npm run local
echo.
echo 页面已停止。
pause
exit /b 0

:waitopen
for /l %%i in (1,1,60) do (
  curl.exe -fsS -o nul http://127.0.0.1:43147/ && start "" http://localhost:43147 && exit /b 0
  timeout /t 1 >nul
)
start "" http://localhost:43147
exit /b 0

:nonode
echo 这台电脑还没有安装 Node.js。
echo 请先打开 https://nodejs.org/zh-cn 安装 LTS 版本。
echo 安装时保持默认选项，装完后重新双击 start.bat。
start "" https://nodejs.org/zh-cn
pause
exit /b 1

:fail
echo.
echo 依赖安装失败。请把这个窗口里的文字发给我。
pause
exit /b 1
