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
$dshCli = "C:\Users\ITSupport\AppData\Local\Programs\DeepSeek Harness Desktop\resources\app.asar.unpacked\node_modules\@deepseek-ai\dsh\lib\bin.js"
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
Write-Host "[1/1] dsh plugin add $spec ..."
& node $dshCli plugin --profile $Profile add $spec
if ($LASTEXITCODE -ne 0) {
    throw "dsh plugin add 失败（exit=$LASTEXITCODE）。若是 git/发布安装，请检查 pnpm-workspace.yaml 的 allowBuilds 配置。"
}
Write-Host "  [done] 已安装并登记到 bundles"

Write-Host ""
Write-Host "完成。下一步："
Write-Host "  1) 完全退出并重启 DeepSeek Harness Desktop（插件条目需在宿主启动时装载）"
Write-Host "  2) 打开 Web GUI 后强制刷新页面（Ctrl+F5）"
Write-Host "  3) 选中任意文本 -> 右键 -> 出现实用工具菜单"
Write-Host "卸载：运行 .\uninstall.ps1"