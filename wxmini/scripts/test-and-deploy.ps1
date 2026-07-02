# 测试 parentAI 云函数连通性，通过后自动部署
# 用法：在 wxmini 目录执行  pwsh -File scripts/test-and-deploy.ps1

$ErrorActionPreference = "Stop"
$wxminiRoot = Split-Path -Parent $PSScriptRoot
Set-Location $wxminiRoot

Write-Host "===== 测试 parentAI 云函数 ====="
$raw = tcb fn invoke parentAI -d "@scripts/test-connection.json" --json
if ($LASTEXITCODE -ne 0) {
    Write-Error "云函数调用失败（tcb exit $LASTEXITCODE）"
    exit 1
}

$result = $raw | ConvertFrom-Json
$retMsg = $result.data.RetMsg | ConvertFrom-Json
if (-not $retMsg.success) {
    $err = if ($retMsg.error) { $retMsg.error } else { "未知错误" }
    Write-Error "测试失败: $err"
    exit 1
}

Write-Host "测试通过: $($retMsg.message)"

Write-Host ""
Write-Host "===== 部署 parentAI ====="
tcb fn deploy parentAI --dir cloudfunctions/parentAI --force
if ($LASTEXITCODE -ne 0) {
    Write-Error "部署失败（tcb exit $LASTEXITCODE）"
    exit 1
}

Write-Host ""
Write-Host "===== 部署完成 ====="
