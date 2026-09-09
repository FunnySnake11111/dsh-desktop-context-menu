# 更新日志

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
