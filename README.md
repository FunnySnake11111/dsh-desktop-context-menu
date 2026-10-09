# dsh-desktop-context-menu

<p align="center">
  <img src="assets/1.png" alt="右键实用工具菜单" width="30%"><br>
  <sub>（截图为 v0.2 界面；v0.3 起视觉已按 Claude 主题整体重做，见下方「主题与视觉」）</sub>
</p>

**专为 [DeepSeek Harness Desktop](https://github.com/ningbainb/deepseek-harness-desktop) 开发的**右键实用工具菜单插件：页面任意位置选中文本后右键，弹出**常用实用工具菜单**（可配置替换原生菜单或同时显示），并提供可驻留的浮动工具条与居中可拖拽的设置模态。

## 功能

- **编辑**：剪切 / 复制 / 粘贴 / **全选**（一级按钮点击即执行，默认 = 当前消息；hover 展开二级菜单：当前消息 / 本轮对话 / 所有消息）· **复制为**（Markdown 引用 / 纯文本 / 无序列表 / 代码块 / 行内代码）
- **搜索**：快捷搜索（Bing / 百度 / Google / DuckDuckGo / 自定义 URL）+ Agent 搜索（路由到会话输入框，可配置自动发送）
- **Agent 快捷动作**：解释 / 总结 / 翻译中英 / 润色改写 / 找 Bug（找 Bug 为代码专用，选中代码时出现）
- **文本工具**：字数统计 · 大小写转换（AA / aa / Aa）
- **翻译 / 站内搜索**：Google 翻译 · DeepL（复制到剪贴板 + 打开翻译器，弹窗提醒粘贴）· 站内搜索（Wikipedia / Stack Overflow / GitHub / MDN / Google / Bing / 掘金 / CSDN / V2EX / Hugging Face / arXiv，均带 hover 说明）
- **复制整条消息**（无选中时禁用）· **导出对话**（Markdown / JSON / PDF 打印另存，自动展开分页历史并剔除工具调用/思考块等元数据）
- **设置**：居中可拖拽模态，五个分组卡片，分段控制 + 开关，所有项即时保存（详见下方「设置」）
- **剪贴板兜底**：与系统剪贴板双向同步（页面内复制/剪切、任何 `clipboard.writeText` 调用、窗口聚焦时尽力读取），外部复制的内容右键粘贴可用

## 主题与视觉

- 视觉层按 [dsh-claude-style](https://github.com/Nwflower/dsh-claude-style) 皮肤的弹层规范构建：**12px 卡片圆角、1px 发丝线边框、6px 内边距、32px 行高（6px 行圆角）、中性 hover wash、单一强调色、0.15s 一次性入场动画**（尊重 `prefers-reduced-motion`）
- **16px 内联线性 SVG 图标**（stroke 跟随 `currentColor`），大小写转换项使用等宽字体字形，明暗自动适配
- **三级主题 token**：`--dsh-claude-*`（皮肤）→ `--dsw-alias-*`（宿主）→ 内置兜底调色板，回退值随宿主 `body[data-ds-dark-theme]` 标记自动切明暗：
  - 装了 dsh-claude-style → Claude 象牙/暗色卡片 + clay `#d97757` 强调色
  - 没装皮肤 → 跟随宿主品牌（DeepSeek 蓝），与周围 UI 观感一致
  - 裸环境（如独立页面）→ 内置 DeepSeek 白/蓝兜底

**纯客户端 DOM 实现**（`inject: []`，零 React/内部结构依赖），随 DSH 应用更新**不会丢失**——插件只活在用户 profile（`~/.dsh`）与浏览器 localStorage，不修改应用安装目录。已对照 **DSH `0.2.0-rc.2`** 逐一核实：`window.__ModuleLoader__.load` 注册机制与全部 DOM 锚点（`data-chat-flow-kind`、`data-turn-tail`、`textarea[data-phase]`、分页按钮等）。

## 安装

插件发布到 **npm registry**，使用 DSH 官方安装通道（底层 pnpm，装完自动把声明了 `dsh.bundle` 的依赖登记进 `dsh.profile.bundles`）：

```powershell
# 标准方式：从 npm registry 安装
dsh plugin --profile desktop add dsh-desktop-context-menu
```

如果你的 `dsh` CLI 不在 PATH，用 node 直接调它的入口：

```powershell
node "C:\Users\ITSupport\AppData\Local\Programs\DeepSeek Harness Desktop\resources\app.asar.unpacked\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile desktop add dsh-desktop-context-menu
```

本地开发可用 link 模式（改代码即时生效，刷新页面即可）：

```powershell
.\install.ps1              # 默认 link: 安装到 desktop profile
.\install.ps1 -Source npm  # 或从 npm 安装
```

> **name 防呆**：本地 `package.json` 的 `name` 必须保持 `dsh-desktop-context-menu`。若为了发布 GitHub Packages 而改成 scoped 名（如 `@funnySnake11111/dsh-desktop-context-menu`），client-modules 会因包名与 loader 条目不一致而跳过客户端加载——右键菜单不显示。改回 `name` 并重启 DSH 即恢复；宿主端会在启动时输出醒目警告。

## 卸载

```powershell
# 标准方式：从 npm registry 卸载（与安装对称）
dsh plugin --profile desktop remove dsh-desktop-context-menu
```

## 设置

右键菜单 → **设置**：打开**居中模态**（带遮罩），头部整条可拖拽，点遮罩 / ✕ / Esc 关闭，所有设置即时生效并持久化（localStorage `dsh.desktopContextMenu.settings`）。

选项按五个分组卡片组织（组内行以发丝线分隔）；2~5 个选项的设置为分段控制，布尔项为开关：

| 分组 | 设置项 | 说明 |
| --- | --- | --- |
| **通用** | 菜单模式 | 替换原生（默认）：吞掉原生菜单；与原生共存：两者同时显示 |
| | 形态 | 右键菜单（默认，点外部关闭）/ 浮动工具条（可拖动驻留） |
| | 显示文本工具 | 关闭后隐藏 字数统计 / 大小写 |
| | 气泡时长 | toast 显示秒数（1–10，默认 3） |
| **全选** | 一级按钮行为 | 点击一级「全选」执行：当前消息（默认）/ 本轮对话 / 所有消息 |
| **搜索** | 搜索引擎 | Bing（默认）/ 百度 / Google / DDG / 自定义 |
| | 自定义 URL | 引擎选「自定义」时就地出现，`{q}` 为查询占位 |
| | 显示翻译与站内搜索 | 关闭后隐藏 翻译 / 站内搜索 两组 |
| **Agent** | 搜索提示语 | 默认 `请搜索并总结：{text}`，`{text}` 为选中文本 |
| | 空闲时自动发送 | 开（默认）：填入后自动发出；关：仅预填输入框 |
| | 快捷动作 | 六个动作独立开关（解释 / 总结 / 翻译成中文 / 翻译成英文 / 润色改写 / 找 Bug），两列排布 |
| **导出** | 用户 / 助手称呼 | 自定义导出对话时的角色显示名 |

## 本地预览

不启动 DSH 也能在浏览器里体验完整交互：

```
preview/claude-preview.html
```

直接双击打开，选中文本右键即可。页面注入了模拟皮肤变量以演示「装了 dsh-claude-style」的观感；删除页内皮肤变量规则即可预览无皮肤时的 DeepSeek 兜底。

## 文件

- `lib/client.js` —— 浏览器端全部逻辑与视觉（`window.__ModuleLoader__.load` 格式，宿主经 `/plugins/dsh-desktop-context-menu/client.js` 提供）
- `lib/index.js` —— 宿主侧：激活 cordis 条目（空实现 + name 防呆警告）
- `cordis.patch.yml` —— 注册条目 `desktop-context-menu` → `dsh-desktop-context-menu`
- `preview/claude-preview.html` —— 浏览器可视化预览页
- `CHANGELOG.md` —— 完整更新日志
- `install.ps1` / `uninstall.ps1` —— 安装/卸载（幂等）

## 更新日志

完整日志见 [CHANGELOG.md](CHANGELOG.md)。

### v0.4.3（2026-10-09）

- 无皮肤环境的兜底调色板从 Claude 换为 DeepSeek（白/蓝，强调色 `#4d6bfe`），三层配色策略自洽；预览页改为注入模拟皮肤变量。

### v0.4.2（2026-10-09）

- **修复设置模态关闭按钮失效**：✕ 的 pointerdown 被拖拽头部捕获并 preventDefault 吞掉了 click；现在按钮先行 `stopPropagation`，拖拽处理对交互元素来源的按下直接忽略。
- 设置页可读性重构：五个分组改为发丝线卡片，组内行以发丝线分隔。

### v0.4.1（2026-10-09）

- **修复设置模态滚动闪退**：捕获级 `scroll` 监听会把模态自身滚动条的滚动当作背景滚动而整体关闭；现在插件自身滚动面（按 `ROOT_ATTR` 祖先链判定）一律忽略，模态打开期间背景滚动/缩放/失焦不再波及。

### v0.4.0（2026-10-09）

- **设置面板推翻重写**：⚙ 打开**居中可拖拽模态**（带遮罩，✕/点遮罩/Esc 关闭，即时生效）；字段按「通用 / 全选 / 搜索 / Agent / 导出」五节组织；2~3 选项改用分段控制、布尔项改用开关；修复动态字段（搜索引擎切「自定义」时 URL 输入框就地出现，不再需要关掉重开）。
- 菜单/飞出层/对话框的贴边翻转与居中定位改用 `offset*` 布局值，不受入场动画期间 `getBoundingClientRect` 变形影响。

### v0.3.0（2026-10-09）

- **Claude 主题视觉重写**：12px 圆角卡片、1px 发丝线边框、6px 内边距、32px 行高（6px 行圆角）、中性 hover wash、单一 clay 强调色（`#d97757`）、0.15s 一次性入场动画（尊重 `prefers-reduced-motion`）、细滚动条。
- **SVG 线性图标库**：全部菜单图标替换为 16px 内联线性 SVG；大小写转换项使用等宽字体字形（AA / aa / Aa）。
- **主题 token 三级回退**：皮肤 → 宿主 → 内置调色板，回退值随 `body[data-ds-dark-theme]` 自动切明暗；补齐 `:focus-visible` 焦点环与复选框 `accent-color`。
- **兼容性核实**（DSH `0.2.0-rc.2` / Desktop 44.0.0）：client-modules 注册机制与 DOM 锚点逐一确认；元数据过滤补充 `data-variant="others"`。

### v0.2.0（2026-09-22）

- **移除 host-patch（宿主补丁自愈）**：DSH Desktop v4.2.1 已自带内置浏览器，外链可直接在应用内打开、`clipboard-read` 已在渲染端放行，原先两处补丁不再必要。删除 `lib/host-patch.mjs` 与 `lib/patches/`，宿主入口恢复为空实现。

### v0.1.3（2026-09-15）

- 确认 Desktop v3.5.0 兼容；新增 `name` 防呆检测（scoped 包名会导致 client-modules 跳过客户端加载，宿主日志输出醒目警告）。

### v0.1.2-hotfix1（2026-09-09）

- host-patch 改用 Electron 的 `original-fs` 读写 app.asar，修复 v3.3.0 下自愈失败（`node:fs` 被打补丁导致 `.asar` 路径抛 `ENOENT`）。

### v0.1.2（2026-09-09）

- 适配 Desktop v3.3.0：asar 重建白名单支持新增的 `runtime-support/` 目录；补丁源更新为 v3.3.0 原始字节。

### v0.1.1

- npm 发布包 `files` 白名单，排除历史备份文件。
