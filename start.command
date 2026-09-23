#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "这台电脑还没有安装 Node.js。"
  echo "请先打开 https://nodejs.org/zh-cn 安装 LTS，装完后重新双击 start.command。"
  open "https://nodejs.org/zh-cn"
  read -r -p "按回车关闭..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "第一次打开，正在下载依赖，请等一两分钟..."
  npm install || {
    echo "依赖安装失败。请把这个窗口里的文字发给我。"
    read -r -p "按回车关闭..."
    exit 1
  }
fi

echo
echo "正在启动持仓全景图。"
echo "请不要关闭这个窗口。关掉它，页面就会停。"
echo "准备好后浏览器会自动打开 http://localhost:43147"
echo

(
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "http://127.0.0.1:43147/"; then
      open "http://localhost:43147"
      exit 0
    fi
    sleep 1
  done
  open "http://localhost:43147"
) &

npm run local
