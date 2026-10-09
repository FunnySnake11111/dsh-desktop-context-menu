# 更新日志

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
