# 微信小程序：改完测通后自动上传部署

**硬性规定**：修改 `wxmini/` 下代码并完成验证后，AI **必须主动执行部署**，不要等用户提醒，也不要只口头说「请手动部署」。

## 触发条件

| 改动范围 | 必须执行 |
|---------|---------|
| `wxmini/cloudfunctions/**` | 测试 + 部署云函数 |
| `wxmini/miniprogram/**`（且涉及云函数调用逻辑） | 若同次会话也改了云函数，一并部署；仅前端 UI 改动则跳过云函数部署 |
| 仅文档 / 注释 / 与本项目无关文件 | 不部署 |

## 执行流程

1. **完成代码修改**（含 lint / 语法检查，如有）
2. **运行测试脚本**（按当前 shell 选一个）：
   - Windows：`powershell -File wxmini/scripts/test-and-deploy.ps1`
   - Bash / Git Bash：`bash wxmini/scripts/test-and-deploy.sh`
3. **测试通过** → 脚本会自动 `tcb fn deploy parentAI`
4. **测试或部署失败** → 排查并修复，重新从第 2 步执行；**不要**在失败状态下声称已部署
5. **向用户汇报**：说明已测试通过并完成部署，或失败原因

## 测试内容

- 调用云端 `parentAI` 的 `testConnection`，确认 DeepSeek API 连通
- 参数文件：`wxmini/scripts/test-connection.json`（避免 Windows 下 JSON 转义问题）

## 禁止事项

- 改完云函数代码后不测试、不部署就结束任务
- 测试失败仍强行部署
- 仅告知用户「请自行部署」而不尝试执行脚本

## 小程序前端说明

当前项目**未配置** `miniprogram-ci` 自动上传。仅改 `miniprogram/` 前端时：

- 云函数无改动 → 无需云函数部署；提醒用户在开发者工具中预览即可
- 若用户明确要求上传体验版/正式版 → 说明需在微信开发者工具手动上传，或后续配置 CI

## 依赖

- 已安装并登录 `@cloudbase/cli`（`tcb`）
- 云环境 ID 见 `wxmini/cloudbaserc.json`
