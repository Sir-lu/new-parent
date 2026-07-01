#!/bin/bash
# 一键部署 parentAI 云函数
# 用法：bash deploy.sh
# 配置来自 cloudbaserc.json（timeout: 60s）

set -e

cd "$(dirname "$0")"

echo "===== 部署 parentAI（超时 60s）====="
tcb fn deploy parentAI --dir cloudfunctions/parentAI --force 2>&1
echo ""
echo "===== 部署完成 ====="
echo "测试命令: wx.cloud.callFunction({ name: 'parentAI', data: { type: 'testConnection' } }).then(r => console.log(r.result))"
