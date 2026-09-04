# =====================================================================
#  dsh-desktop-context-menu - Install script  (标准 dsh plugin 安装)
#
#  走 DSH 官方插件安装通道：`dsh plugin --profile <name> add <spec>`
#  （底层是 pnpm，装完自动把声明了 dsh.bundle 的依赖登记进 bundles）。
#
#  用法：
#    powershell -ExecutionPolicy Bypass -File .\install.ps1
#        # 本地开发模式（默认）：以 link: 安装到工作区，改代码即时生效
#    powershell -ExecutionPolicy Bypass -File .\install.ps1 -Source npm
#        # 发布模式：从 npm registry 安装已发布的版本
#    powershell -ExecutionPolicy Bypass -File .\install.ps1 -Profile web
#        # 指定 profile（默认 desktop）
#
#  注意：Windows 下 dsh plugin 对含空格的 link 路径解析失败，
#        link 模式会自动改用 8.3 短路径（如 G:\DEEPSE~1\...）规避。
#  =====================================================================
param(
    [string]$Profile = 'desktop',
    [ValidateSet('link', 'npm')]
    [string]$Source = 'link'
)
$ErrorActionPreference = 'Stop'
$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgName    = 'dsh-desktop-context-menu'
$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"

Write-Host "== dsh-desktop-context-menu install =="
Write-Host "  profile : $profileDir"
Write-Host "  source  : $Source"

# ---- 定位 dsh CLI（不在 PATH，直接以 node 调 bin.js）----
$dshCli = "D:\Deepseek Harness\DeepSeek Harness Desktop\resources\app.asar.unpacked\node_modules\@deepseek-ai\dsh\lib\bin.js"
if (-not (Test-Path $dshCli)) {
    throw "找不到 dsh CLI：$dshCli （请确认 DeepSeek Harness Desktop 安装路径）"
}
Write-Host "  dsh CLI : $dshCli"

# ---- 构造安装 spec（link 模式用 8.3 短路径规避空格）----
$spec = switch ($Source) {
    'npm'  { $pkgName }
    'link' {
        $fso = New-Object -ComObject Scripting.FileSystemObject
        try {
            $short = $fso.GetFolder($here).ShortPath
        } catch {
            $short = $here
        }
        "link:$short"
    }
}
Write-Host "  spec    : $spec"

# ---- 执行标准安装（pnpm add + 自动 reconcile bundles）----
Write-Host ""
Write-Host "[1/2] dsh plugin add $spec ..."
& node $dshCli plugin --profile $Profile add $spec
if ($LASTEXITCODE -ne 0) {
    throw "dsh plugin add 失败（exit=$LASTEXITCODE）。若是 git/发布安装，请检查 pnpm-workspace.yaml 的 allowBuilds 配置。"
}
Write-Host "  [done] 已安装并登记到 bundles"

# ---- 定位安装后的插件目录（link 模式下即工作区本身）----
$targetDir = if ($Source -eq 'link') {
    $here
} else {
    Join-Path $profileDir "node_modules\$pkgName"
}

# ---- 立即应用 host-patch（导航策略 + 剪贴板权限），应用关闭时最安全 ----
Write-Host ""
Write-Host "[2/2] host-patch（导航策略 + 剪贴板权限补丁）"
$hostPatchCli = Join-Path $targetDir 'lib\host-patch.mjs'
if (Test-Path $hostPatchCli) {
    & node $hostPatchCli
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [done] host-patch 已就绪"
    } else {
        Write-Host "  [warn] host-patch 未能应用（可稍后运行 node $hostPatchCli 重试）"
    }
} else {
    Write-Host "  [skip] 未找到 lib\host-patch.mjs"
}

Write-Host ""
Write-Host "完成。下一步："
Write-Host "  1) 完全退出并重启 DeepSeek Harness Desktop（插件条目需在宿主启动时装载）"
Write-Host "  2) 打开 Web GUI 后强制刷新页面（Ctrl+F5）"
Write-Host "  3) 选中任意文本 -> 右键 -> 出现实用工具菜单"
Write-Host "  4) 聊天超链接走系统浏览器、外部复制可右键粘贴（host-patch 已随插件集成）"
Write-Host "卸载：运行 .\uninstall.ps1"