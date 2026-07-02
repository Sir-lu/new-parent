#!/bin/bash
# 测试 parentAI 云函数连通性，通过后自动部署
# 用法：bash scripts/test-and-deploy.sh（在 wxmini 目录）

set -e

cd "$(dirname "$0")/.."

echo "===== 测试 parentAI 云函数 ====="
RAW=$(tcb fn invoke parentAI -d @scripts/test-connection.json --json)
SUCCESS=$(echo "$RAW" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const ret = JSON.parse(d.data.RetMsg);
  if (!ret.success) {
    console.error('测试失败:', ret.error || '未知错误');
    process.exit(1);
  }
  console.log('测试通过:', ret.message);
")

echo "$SUCCESS"
echo ""
echo "===== 部署 parentAI ====="
tcb fn deploy parentAI --dir cloudfunctions/parentAI --force
echo ""
echo "===== 部署完成 ====="
