#!/bin/sh
# Container entrypoint：先跑 prisma migrate deploy，成功才啟動 Nitro server
# 失敗以非 0 exit，讓 orchestrator（Railway / Docker host）保留前一個健康容器，
# 並在 deploy log 留下完整錯誤訊息供排查
set -e

echo "[deploy] running prisma migrate deploy..."
node ./node_modules/prisma/build/index.js migrate deploy
echo "[deploy] migrate deploy OK"

exec node ./.output/server/index.mjs
