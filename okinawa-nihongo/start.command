#!/bin/bash
# Mac에서 더블클릭하면 서버가 켜지고, 아이폰 연결용 QR 화면이 열려요.
cd "$(dirname "$0")"
if command -v cloudflared >/dev/null 2>&1 && [ -z "$PUBLIC_URL" ]; then
  (sleep 2; open "http://localhost:${PORT:-8787}/connect.html") &
  node server.js --tunnel
else
  (sleep 1; open "http://localhost:${PORT:-8787}/connect.html") &
  node server.js
fi
