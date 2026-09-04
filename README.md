# dsh-desktop-context-menu

**专为 [ningbainb/deepseek-harness-desktop](https://github.com/ningbainb/deepseek-harness-desktop) 开发的**右键实用工具菜单插件：页面任意位置选中文本后右键，弹出**常用实用工具菜单**（可配置替换原生菜单或同时显示），并提供可驻留的浮动工具条。

## 功能

- **编辑**：剪切 / 复制 / 粘贴 / **全选**（一级按钮点击即执行，默认 = 当前消息；hover 展开二级菜单：当前消息 / 本轮对话 / 所有消息）· **复制为**（Markdown 引用/纯文本/无序列表/代码块/行内代码）
- **搜索**：快捷搜索（Bing/百度/Google/DuckDuckGo/自定义 URL）+ Agent 搜索（路由到会话输入框）
- **Agent 快捷动作**：解释 / 总结 / 翻译中英 / 润色改写 / 找 Bug（找 Bug 为代码专用，选中代码时出现）
- **文本工具**：字数统计 · 大小写转换
- **翻译 / 站内搜索**：Google 翻译 · DeepL（复制到剪贴板 + 打开翻译器，弹窗提醒粘贴）· 站内搜索（Wikipedia / Stack Overflow / GitHub / MDN / Google / Bing / 掘金 / CSDN / V2EX / Hugging Face / arXiv，均带 hover 说明）
- **复制整条消息**（无选中时禁用）· **导出对话**（Markdown / JSON / PDF 打印另存）
- **设置**：菜单模式、形态（右键菜单/浮动工具条）、全选一级按钮行为、搜索引擎、Agent 提示语、自动发送、功能开关、气泡时长、导出角色称呼
- 菜单内所有项统一对齐（等宽图标列 + 文字 + 右箭头），右上角 ✕ 平面关闭按钮保留按钮反馈
- 剪贴板与系统同步（页面内复制/剪切、任何 `clipboard.writeText` 调用、窗口聚焦时尽力读取，外部复制内容右键粘贴可用）

**纯客户端 DOM 实现**（`inject: []`，零 React/内部结构依赖），随 DSH 应用更新**不会丢失**——插件只活在用户 profile（`~/.dsh`）与浏览器 localStorage，不修改应用安装目录。

## 内置 host-patch（宿主补丁自愈）

桌面版默认有两处宿主行为会破坏渲染端功能，本插件**自带补丁并自动维护**：

1. **导航策略**（外链转系统浏览器）：桌面版默认拦截渲染端发起的 http(s) 弹窗并静默丢弃外部导航，导致聊天里的超链接、搜索源打不开系统浏览器。补丁 `lib/patches/navigation-policy.mjs` 将其放行到系统浏览器。
2. **剪贴板权限**（loopback 放行 `clipboard-read`）：桌面版只允许 `clipboard-sanitized-write`，渲染端 `navigator.clipboard.readText()` 被拒，外部复制的内容粘贴失败。补丁 `lib/patches/renderer-permissions.mjs` 在相同安全边界（仅 loopback 来源）下同时放行 `clipboard-read`。

自愈机制：
- 宿主（主进程）加载插件时自动检测 `app.asar` 内各补丁目标是否带 `[user-patch]` 标记；缺失则备份 → 重建（只替换补丁目标，其余 134 个 in-asar 文件字节级不变）→ 写回 → 验证
- **幂等**：已打补丁则跳过；**永不抛错**：任何失败只记录日志，不影响插件树
- 因此 DSH 应用更新覆盖 `app.asar` 后，**下次启动自动重打，无需手动步骤**（不再需要 `apply-link-fix.ps1`）
- `install.ps1` 安装时也会立即应用一次（应用关闭时最安全）

手动备用：`node lib\host-patch.mjs`（无参数自动定位 app.asar，也可传路径）。

**卸载会自动撤销**：`uninstall.ps1` 会调用 `node lib\host-patch.mjs --undo`，把 `app.asar` 的宿主补丁还原（首选最近一次的 `app.asar.bak-hostpatch-*` / `app.asar.bak-linkfix-*` 备份做字节级还原；无备份时用内置原版 `lib/patches/orig-*.mjs` 重建）。还原后聊天链接与剪贴板权限回到桌面默认行为。

## 安装

插件发布到 **npm registry**，使用 DSH 官方安装通道（底层 pnpm，装完自动把声明了 `dsh.bundle` 的依赖登记进 `dsh.profile.bundles`）：

```powershell
# 标准方式：从 npm registry 安装
dsh plugin --profile desktop add dsh-desktop-context-menu
```

如果你的 `dsh` CLI 不在 PATH（本机常见情况），用 node 直接调它的入口：

```powershell
node "D:\Deepseek Harness\DeepSeek Harness Desktop\resources\app.asar.unpacked\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile desktop add dsh-desktop-context-menu
```

装完后**完全退出并重启 DeepSeek Harness Desktop**，打开 Web GUI 后**强制刷新（Ctrl+F5）**。

> 从旧名 `dsh-chat-search` 升级：先运行旧目录 `uninstall.ps1` 清理，再按上述方式安装新名。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

走标准 `dsh plugin remove` + 自动撤销 host-patch。同样重启 + 硬刷新生效。

## 设置

右键菜单 → **⚙ 设置**（点入二级面板）可即时调整并持久化（localStorage `dsh.desktopContextMenu.settings`）：

| 设置 | 说明 |
| --- | --- |
| 菜单模式 | `replace`（默认）：替换原生菜单；`floating`：与原生菜单同时显示 |
| 形态 | `menu`（默认）：右键菜单，点外部关闭；`dock`：可拖动驻留浮动工具条 |
| 全选一级按钮行为 | 点击一级「全选」时执行的动作：`current`（默认）当前消息 / `turn` 本轮对话 / `all` 所有消息 |
| 搜索引擎 | bing（默认）/ baidu / google / duckduckgo / 自定义 URL（`{q}` 为查询占位） |
| Agent 提示语 | 默认 `请搜索并总结：{text}`，`{text}` 为选中文本 |
| 自动发送 | 开（默认）：空闲会话自动发出；关：仅预填输入框 |
| 气泡时长 | toast 显示秒数（1–10，默认 3） |
| 导出称呼 | 自定义导出对话时「用户 / 助手」的显示名 |

## 文件

- `lib/client.js` —— 浏览器端逻辑（`window.__ModuleLoader__.load` 格式，宿主经 `/plugins/dsh-desktop-context-menu/client.js` 提供）
- `lib/index.js` —— 宿主侧：激活 cordis 条目 + 启动时自愈 host-patch
- `lib/host-patch.mjs` —— 宿主补丁自愈/撤销模块（定位/检测/备份/重建/替换/验证，CLI 可单独运行：`--undo` 撤销）
- `lib/patches/navigation-policy.mjs` —— 补丁源：主进程导航策略（外链转系统浏览器）
- `lib/patches/renderer-permissions.mjs` —— 补丁源：渲染进程权限（loopback 放行 `clipboard-read`）
- `lib/patches/orig-*.mjs` —— 各补丁的原版源码（撤销、无备份时还原用）
- `cordis.patch.yml` —— 注册条目 `desktop-context-menu` → `dsh-desktop-context-menu`
- `install.ps1` / `uninstall.ps1` —— 安装/卸载（幂等；卸载自动撤销 host-patch）
