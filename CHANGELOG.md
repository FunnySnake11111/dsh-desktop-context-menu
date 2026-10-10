# 更新日志

## v0.4.6（2026-10-10）

### 文档

- README「主题与视觉」章节新增搭配建议：与 [dsh-claude-style](https://github.com/Nwflower/dsh-claude-style) 一并使用以获得最佳的视觉体验。（代码无变化）

## v0.4.5（2026-10-09）

### 变更

- **仓库瘦身**：移除旧第三方 desktop 分支环境遗留的 `install.ps1` / `uninstall.ps1`（内含特定机器的 CLI 绝对路径与 8.3 短路径 workaround），安装/卸载统一走标准 `dsh plugin --profile desktop add/remove` 通道，link 开发模式直接写入 README；同时移除 `preview/` 开发预览页与磁盘上的陈旧 `.bak` 备份、仓库内 `.npmrc`（GitHub Packages 实验残留）。插件运行四件套（`lib/client.js`、`lib/index.js`、`cordis.patch.yml`、`package.json`）与文档不变。

## v0.4.4（2026-10-09）

### 修复

- **对话流空白处右键时「当前消息 / 本轮对话」不可用**：两个按钮的可用性此前依赖右键落点精确命中带 `data-chat-flow-kind` 的消息行，点在消息间隙、末条消息下方的留白或列内边距时被禁用。现在落点在对话区域内但未命中消息行时，回退到**离点击位置最近的消息行**（行带几何距离判定，命中行带内记 0 距离，平局取文档序靠前的外层行）；落点远离对话区域（±48px 之外）仍保持禁用。一级「全选」按钮（默认 = 当前消息）与二级菜单共用同一解析器，行为一致。
- **未启用 Claude Style 时界面一片死灰**：核实当前宿主运行时的 alias 调色板本身是中性灰方案（暗色 `bg-overlay` 解析为灰、发丝线仅 6% 白、`brand-primary` 也解析为灰阶），此前「无皮肤时跟随宿主 alias」导致菜单整体灰掉。配色解析改为**两级**：有皮肤（`body[data-dsh-claude-style]`）时走皮肤变量（Claude 观感不变）；无皮肤时直接采用**固定调色板**（亮色白卡片；暗色黑灰卡片 `#202124`，强调色保持 DeepSeek 蓝 `#4d6bfe`，发丝线与阴影可见），不再经过宿主灰阶 alias。新增 `--dcm-on-accent`（强调色上的文字/滑块）与 `--dcm-field`（分段控制/输入框底色）token。
- **Agent 搜索 / Agent 动作失效**：当前运行时的输入框已从 `textarea` 换为 Lexical contenteditable（`ComposerContentEditable`，`data-phase` + `data-placeholder`），旧的 `textarea[data-phase]` 与可见 textarea 扫描两条路径全部落空，`findComposer()` 恒为 null，按钮一直处于禁用态。现在优先匹配**可见的 contenteditable**（`[contenteditable="true"][data-phase]` / `[data-placeholder]`，与会话根容器的 `data-phase` 通过 contenteditable 区分），textarea 仅作旧版回退；填充改走 `execCommand` selectAll + insertText（触发 Lexical 监听的 beforeinput/input 事件链），发送按钮回退匹配更新为「发送消息」（locale `input.send`），锁定判定补充 `aria-disabled`。

### 变更

- 「翻译」子菜单中经 Agent 路由的两项更名为「由Agent 翻译成中文 / 由Agent 翻译成英文」，与站点直达（Google 翻译 / DeepL）区分；Agent 动作子菜单内的同名项不变。
- **菜单重排**：搜索相关聚为一组——快捷搜索 → 站点搜索 → Agent 搜索 → Agent 动作；文本工具组为 字数统计 → 大小写 → 翻译。「站内搜索」更名「站点搜索」，设置开关同步为「显示翻译与站点搜索」；Agent 动作改由自身可用条件控制（不再受「显示文本工具」开关影响）。

## v0.4.3（2026-10-09）

> 本条涵盖 **v0.3.0 → v0.4.3** 的全部变更（中间版本未单独发布，随 `v0.4.3` 标签一次性发布）。

### Claude 主题视觉重写

- 视觉层按 dsh-claude-style 皮肤（palette: claude）的弹层规范重建：12px 圆角卡片、1px 发丝线边框、6px 内边距、32px 行高（2px 7px 内边距、6px 行圆角）、中性 hover wash、单一 clay 强调色（`#d97757`）、0.15s 一次性入场动画（尊重 `prefers-reduced-motion`）、细滚动条。
- 全部菜单图标替换为 16px 内联线性 SVG（stroke 跟随 `currentColor`），大写/小写转换项使用等宽字体字形（AA / aa / Aa），明暗自动适配。
- 主题 token 三级回退：`--dsh-claude-*`（皮肤）→ `--dsw-alias-*`（宿主）→ 内置兜底调色板；回退值随宿主 `body[data-ds-dark-theme]` 标记自动切明暗。兜底为 DeepSeek 白/蓝（亮：白底 `#ffffff` / 墨字 `#0f1115` / 发丝线 `#e7ecf7`；暗：`#212631` / `#eef1f8` / `#2a303c`；强调色统一 `#4d6bfe`，hover 亮 `#3a57e8` / 暗 `#6a84ff`）——无皮肤时菜单跟随宿主品牌，裸环境观感一致。
- 可访问性：补齐 `:focus-visible` 焦点环（跟随 `--dsw-focus-ring-color`）、开关 `accent-color` 使用品牌色。

### 设置模态重做

- **居中可拖拽模态**：点 ⚙ 屏幕居中弹出独立设置对话框（带遮罩），不再是 ⚙ 旁挤出的细长飞出面板；头部（grip + 标题 + ✕）整条可拖拽，指针捕获 + 视口夹取；点遮罩 / ✕ / Esc 关闭，设置即时生效、无保存按钮。
- **分组卡片**：字段按「通用 / 全选 / 搜索 / Agent / 导出」五节组织，发丝线卡片 + 组内行分隔线（grouped-list 模式），不再一列平铺。
- **分段控制与开关**：菜单模式、形态、全选行为、搜索引擎改用 Claude 风分段控件（chip 轨道 + 中性高亮活动项）；全部布尔项（显示文本工具、翻译与站内搜索、自动发送、六个 Agent 动作）改为 Claude 风开关，Agent 动作两列排布。
- **动态字段修复**：搜索引擎切「自定义」时 URL 输入框就地即时出现——旧面板只在打开时构建一次，需关掉重开才能看到。

### 修复

- **设置模态滚动闪退**：捕获级 `scroll` 监听会把模态自身滚动条的滚动当作背景滚动而整体关闭；现在插件自身滚动面（按 `ROOT_ATTR` 祖先链判定）一律忽略，模态打开期间背景滚动 / 缩放 / 失焦不再波及，关闭只走 ✕ / 点遮罩 / Esc 三条路径。
- **设置模态 ✕ 失效**：✕ 的 pointerdown 被拖拽头部 `setPointerCapture` + `preventDefault` 吞掉后续 click；现在按钮先行 `stopPropagation`，且拖拽处理对来源为交互元素（button/input/select/textarea）的按下直接忽略。
- 菜单 / 飞出层 / 对话框的贴边翻转与居中定位改用 `offsetLeft/Top/Width/Height` 布局值，不受 0.15s 入场缩放动画期间 `getBoundingClientRect` 变形影响。

### 兼容性

- 确认 **DSH 0.2.0-rc.2**（Desktop 44.0.0）client-modules 机制完全兼容：`window.__ModuleLoader__.load` 注册、`dsh.client` 声明、`exports["./client"]` 解析均与当前运行时一致。
- DOM 锚点逐一核对当前 `dsh-client-ui-chat` / `dsh-client-ui-conversation` bundle：`data-chat-flow-kind`、`data-turn-tail`、`data-chat-anchor-key`、`data-conversation-scroll`、`textarea[data-phase]`、"加载更早"按钮均在。
- 「剔除元数据」过滤选择器补充新版 `data-variant="others"` 块（旧锚点 `data-tool` / `data-chat-call-id` / `data-produced-files-row` 已从新版 chat UI 消失，保留在选择器中无害）。
- 功能、设置项、存储键（含旧键迁移）全部不变；仅视觉层与设置交互重写。
- 预览页（`preview/claude-preview.html`）注入模拟皮肤变量，演示「装了 dsh-claude-style」的观感；删除页内皮肤变量规则即可预览 DeepSeek 兜底。

## v0.1.3（2026-09-15）

### 新增

- **name 防呆检测**：宿主端加载时校验 `package.json` 的 `name` 必须为 `dsh-desktop-context-menu`。若被改成 scoped 名（如发布 GitHub Packages 时），DSH v3.5.0 的 client-modules 会因包名与 loader 条目不一致而跳过该包，导致右键菜单不显示（host 端补丁仍正常）——现在会在宿主日志输出醒目警告。

### 兼容性

- 确认 DeepSeek Harness Desktop **v3.5.0** 下 host-patch 工作正常：v3.5.0 原版仍默认丢弃渲染端外链（`http:` 连 `external` 分类都没有，`window.open` 弹窗一律 deny）且不放行 `clipboard-read`，两处补丁依旧必要，自愈实测通过。

## v0.1.2-hotfix1（2026-09-09）

### 修复

- **真正修复 v3.3.0 下的自愈失败**：v0.1.2 虽然放宽了 `runtime-support/` 白名单，但 Electron 主进程对 `node:fs` 打补丁，任何以 `.asar` 结尾的路径都会被当作 asar 归档访问（`readFileFromArchiveSync`），直接读取 app.asar 归档本身会抛 `ENOENT: not found in <archive>`，导致自愈在桌面版宿主里仍然失败、补丁从未真正写入。
- 现在改用 Electron 提供的 **`original-fs`**（未被打补丁的原生 fs）读写 app.asar，纯 Node 环境自动回退 `node:fs`——自愈在桌面版 v3.3.0 下已实测成功打补丁，外链跳转系统浏览器、loopback 剪贴板读取均生效。

### 行为不变

- 外链（http/https）转系统浏览器；loopback 来源放行 `clipboard-read`。

## v0.1.2（2026-09-09）

### 修复

- 适配 DeepSeek Harness Desktop **v3.3.0**：host-patch 的 asar 重建白名单支持 v3.3.0 新增的 `runtime-support/` 目录。此前 v3.3.0 的 app.asar 中新增了 `runtime-support/community-plugin-known-issues.json`，被旧的路径白名单判定为「意外文件」而中止，导致自愈失败（日志报 `failed: ENOENT, not found in ...app.asar`），右键菜单在 v3.3.0 下失效。
- 补丁源与撤销源（`lib/patches/*`）更新为 v3.3.0 的原始字节（CRLF），确保 `--undo` / 无备份还原时能精确恢复官方原版。

### 行为不变

- 外链（http/https）转系统浏览器：聊天中的 Markdown 链接、搜索结果等可正常打开；
- loopback 来源放行 `clipboard-read`：外部复制的文本可正常粘贴到渲染进程。

## v0.1.1

- npm 发布包 `files` 白名单，排除历史备份文件（`.bak-*`），包体精简。
