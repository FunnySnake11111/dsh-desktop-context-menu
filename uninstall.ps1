# =====================================================================
#  dsh-desktop-context-menu - Uninstall script  (标准 dsh plugin 卸载)
#
#  走 DSH 官方插件卸载通道：`dsh plugin --profile <name> remove <pkg>`
#  （pnpm remove + 自动从 bundles 移除），并撤销 host-patch。
#
#  用法： powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
# =====================================================================
param(
    [string]$Profile = 'desktop'
)
$ErrorActionPreference = 'Stop'
$pkgName    = 'dsh-desktop-context-menu'
$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"

Write-Host "== dsh-desktop-context-menu uninstall =="
Write-Host "  profile : $profileDir"

# ---- 定位 dsh CLI ----
$dshCli = "D:\Deepseek Harness\DeepSeek Harness Desktop\resources\app.asar.unpacked\node_modules\@deepseek-ai\dsh\lib\bin.js"
if (-not (Test-Path $dshCli)) {
    throw "找不到 dsh CLI：$dshCli"
}

# ---- 先撤销 host-patch（还原 app.asar 宿主补丁）----
# link 模式装在非标准位置，先尝试从 node_modules 找；找不到就跳过（宿主启动时也会自愈）
$candidate = Join-Path $profileDir "node_modules\$pkgName\lib\host-patch.mjs"
if (Test-Path $candidate) {
    Write-Host ""
    Write-Host "[host-patch] 撤销补丁（还原 app.asar 宿主补丁）"
    & node $candidate --undo
    if ($LASTEXITCODE -eq 0) { Write-Host "  [done] host-patch 已撤销" }
    else { Write-Host "  [warn] host-patch 撤销失败（可稍后手动 node $candidate --undo）" }
} else {
    Write-Host ""
    Write-Host "[host-patch] 未在 node_modules 找到（可能是 link 模式），跳过撤销"
}

# ---- 标准卸载：dsh plugin remove ----
Write-Host ""
Write-Host "[1/1] dsh plugin remove $pkgName ..."
& node $dshCli plugin --profile $Profile remove $pkgName
if ($LASTEXITCODE -ne 0) {
    throw "dsh plugin remove 失败（exit=$LASTEXITCODE）"
}
Write-Host "  [done] 已从 profile 移除并取消 bundles 登记"

Write-Host ""
Write-Host "完成。重启 DeepSeek Harness Desktop 并强制刷新（Ctrl+F5）后生效。"