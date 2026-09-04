// dsh-desktop-context-menu — browser half.
// Select non-empty text anywhere, right-click → a context menu with:
//   editing actions 剪切/复制/粘贴/全选
//   🔍 快捷搜索 · 🤖 Agent 搜索
//   💡 Agent 快捷动作 (解释/总结/翻译/润色/找Bug)
//   📊 字数统计 · 📋 复制为(引用/纯文本/列表/代码块/行内代码) · 🔠 大小写转换
//   🌐 翻译 · 🧭 站内搜索
//
// Two modes (settings → mode):
//   replace  (default): swallow the native context menu entirely.
//   floating: keep the native menu AND show this toolbar alongside.
// Two forms (settings → toolbar):
//   menu (default): transient, closes on outside click/scroll.
//   dock: persistent draggable floating toolbar.
//
// Pure DOM, zero requires, inject: [] — no coupling to React internals,
// so it keeps working across DSH updates.
window.__ModuleLoader__.load({
	id: "dsh-desktop-context-menu",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// ------------------------------------------------------------------
		// settings (localStorage)
		// ------------------------------------------------------------------
		// New key; migrate from the legacy key so existing settings survive
		// the dsh-chat-search → dsh-desktop-context-menu rename.
		var STORAGE_KEY = "dsh.desktopContextMenu.settings";
		var LEGACY_STORAGE_KEY = "dsh.chatSearch.settings";
		var DEFAULT_SETTINGS = {
			// "replace" = swallow native menu, show our menu instead (default);
			// "floating" = keep native menu AND show our toolbar.
			mode: "replace",
			// "menu" = transient context menu, closes on outside click/scroll;
			// "dock" = persistent draggable floating toolbar (close via ✕/Esc/action).
			toolbar: "menu",
			engine: "bing", // bing | baidu | google | duckduckgo | custom
			customUrl: "", // used when engine === "custom"; {q} is the query
			agentPrompt: "请搜索并总结：{text}",
			autoSubmit: true,
			// feature group toggles
			showTextTools: true, // 统计/引用/大小写
			showSites: true, // 翻译/更多站点
			// per-action toggles (Agent 快捷动作)
			agentActions: {
				explain: true,
				summarize: true,
				translateZh: true,
				translateEn: true,
				polish: true,
				bug: true
			},
			toastSeconds: 3,
			// 一级「全选」按钮点击时的行为：current=当前消息 / turn=本轮对话 / all=所有消息
			selectAllPrimary: "current",
			// export labels
			userLabel: "用户",
			assistantLabel: "助手"
		};
		var ENGINES = {
			bing: { name: "Bing", url: (q) => "https://www.bing.com/search?q=" + encodeURIComponent(q) },
			baidu: { name: "百度", url: (q) => "https://www.baidu.com/s?wd=" + encodeURIComponent(q) },
			google: { name: "Google", url: (q) => "https://www.google.com/search?q=" + encodeURIComponent(q) },
			duckduckgo: { name: "DuckDuckGo", url: (q) => "https://duckduckgo.com/?q=" + encodeURIComponent(q) }
		};
		// Agent 快捷动作：prompt 模板里的 {text} 会被替换为选中文本。
		var AGENT_ACTIONS = {
			explain: { label: "解释", icon: "💡", prompt: "请解释这段内容：{text}" },
			summarize: { label: "总结", icon: "📝", prompt: "请总结这段内容：{text}" },
			translateZh: { label: "翻译成中文", icon: "🌐", prompt: "请把这段内容翻译成流畅的中文：{text}" },
			translateEn: { label: "翻译成英文", icon: "🌐", prompt: "请把这段内容翻译成流畅的英文：{text}" },
			polish: { label: "润色改写", icon: "✨", prompt: "请润色改写这段内容，保持原意：{text}" },
			bug: { label: "找 Bug", icon: "🔍", prompt: "请检查这段代码并指出 Bug：{text}", codeOnly: true }
		};
		// 站点直达：打开系统浏览器（依赖 dsh-link-fix 补丁）。
		// desc 用于菜单项的 hover 提示（title）。
		// gtranslate / deepl 是「翻译」子菜单使用的站点，也放在这里统一管理。
		var SITES = {
			wikipedia: { label: "Wikipedia", desc: "中文维基百科 · 词条与概念", url: (q) => "https://zh.wikipedia.org/w/index.php?search=" + encodeURIComponent(q) },
			stackoverflow: { label: "Stack Overflow", desc: "编程问答 · 查报错与方案", url: (q) => "https://stackoverflow.com/search?q=" + encodeURIComponent(q) },
			github: { label: "GitHub", desc: "开源代码 · 仓库 / Issue 搜索", url: (q) => "https://github.com/search?q=" + encodeURIComponent(q) },
			mdn: { label: "MDN", desc: "Web 权威文档 · HTML/CSS/JS/API", url: (q) => "https://developer.mozilla.org/zh-CN/search?q=" + encodeURIComponent(q) },
			google: { label: "Google", desc: "通用网页搜索", url: (q) => "https://www.google.com/search?q=" + encodeURIComponent(q) },
			bing: { label: "Bing", desc: "通用网页搜索", url: (q) => "https://www.bing.com/search?q=" + encodeURIComponent(q) },
			juejin: { label: "掘金", desc: "中文技术社区文章搜索", url: (q) => "https://juejin.cn/search?query=" + encodeURIComponent(q) },
			csdn: { label: "CSDN", desc: "中文技术博客搜索", url: (q) => "https://so.csdn.net/so/search?q=" + encodeURIComponent(q) },
			v2ex: { label: "V2EX", desc: "sov2ex 站内搜索（更全）", url: (q) => "https://www.sov2ex.com/?q=" + encodeURIComponent(q) },
			huggingface: { label: "Hugging Face", desc: "AI 模型与数据集搜索", url: (q) => "https://huggingface.co/search/full-text?q=" + encodeURIComponent(q) },
			arxiv: { label: "arXiv", desc: "学术论文预印本搜索", url: (q) => "https://arxiv.org/search/?query=" + encodeURIComponent(q) + "&searchtype=all" },
			gtranslate: { label: "Google 翻译", desc: "Google 在线翻译", url: (q) => "https://translate.google.com/?sl=auto&tl=zh-CN&text=" + encodeURIComponent(q) },
			deepl: { label: "DeepL", desc: "DeepL 翻译器（复制后粘贴）", url: () => "https://www.deepl.com/translator" }
		};
		// 站点在「站内搜索」子菜单中的显示顺序（不含翻译类）。
		var SITE_ORDER = ["wikipedia", "stackoverflow", "github", "mdn", "google", "bing", "juejin", "csdn", "v2ex", "huggingface", "arxiv"];

		function loadSettings() {
			var out = {};
			for (var k in DEFAULT_SETTINGS) {
				if (DEFAULT_SETTINGS[k] && typeof DEFAULT_SETTINGS[k] === "object") {
					out[k] = {};
					for (var sk in DEFAULT_SETTINGS[k]) out[k][sk] = DEFAULT_SETTINGS[k][sk];
				} else {
					out[k] = DEFAULT_SETTINGS[k];
				}
			}
			try {
				// Migrate once from the legacy storage key (pre-rename).
				var raw = window.localStorage.getItem(STORAGE_KEY);
				if (!raw) {
					var legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
					if (legacy) {
						window.localStorage.setItem(STORAGE_KEY, legacy);
						window.localStorage.removeItem(LEGACY_STORAGE_KEY);
						raw = legacy;
					}
				}
				if (raw) {
					var parsed = JSON.parse(raw);
					if (parsed && typeof parsed === "object") {
						for (var key in DEFAULT_SETTINGS) {
							var pv = parsed[key];
							var dv = DEFAULT_SETTINGS[key];
							if (pv === undefined) continue;
							if (dv && typeof dv === "object") {
								for (var sub in dv) if (typeof pv[sub] === typeof dv[sub]) out[key][sub] = pv[sub];
							} else if (typeof pv === typeof dv) {
								out[key] = pv;
							}
						}
					}
				}
			} catch (e) { /* storage unavailable → defaults */ }
			return out;
		}
		function saveSettings(patch) {
			var next = loadSettings();
			for (var p in patch) {
				if (patch[p] && typeof patch[p] === "object" && next[p] && typeof next[p] === "object") {
					for (var sp in patch[p]) next[p][sp] = patch[p][sp];
				} else {
					next[p] = patch[p];
				}
			}
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch (e) { /* ignore */ }
		}
		function engineUrl(settings, q) {
			if (settings.engine === "custom" && settings.customUrl && settings.customUrl.indexOf("{q}") !== -1) {
				return settings.customUrl.replace("{q}", encodeURIComponent(q));
			}
			var engine = ENGINES[settings.engine] || ENGINES.bing;
			return engine.url(q);
		}

		// ------------------------------------------------------------------
		// selection
		// ------------------------------------------------------------------
		var savedRange = null;
		// Plugin-owned clipboard: anything copied through OUR menu is remembered
		// here, so 粘贴 keeps working even when the system clipboard is
		// unreadable (Electron may deny clipboard-read permission).
		var ownClipboard = null;
		function selectedText() {
			var sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) return "";
			var text = (sel.toString() || "").trim();
			if (text.length > 2000) text = text.slice(0, 2000);
			return text;
		}
		function saveSelection() {
			savedRange = null;
			try {
				var sel = window.getSelection();
				if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
			} catch (e) { /* ignore */ }
		}
		function restoreSelection() {
			if (!savedRange) return;
			try {
				var sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(savedRange);
			} catch (e) { /* ignore */ }
		}

		// ------------------------------------------------------------------
		// editing actions (剪切 / 复制 / 粘贴 / 全选)
		// ------------------------------------------------------------------
		function isEditable(el) {
			return !!(el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable === true));
		}
		function editableSelectionLength(el) {
			if (!isEditable(el)) return 0;
			if (typeof el.selectionStart === "number") return el.selectionEnd - el.selectionStart;
			try {
				var sel = window.getSelection();
				return sel && sel.rangeCount > 0 && el.contains(sel.anchorNode) ? sel.toString().length : 0;
			} catch (e) { return 0; }
		}
		function hasAnySelection() {
			return selectedText() !== "" || editableSelectionLength(document.activeElement) > 0;
		}
		function doCopy() {
			restoreSelection();
			var text = "";
			try { text = window.getSelection().toString(); } catch (e) { /* ignore */ }
			if (text) ownClipboard = text; // remember for in-plugin paste fallback
			var ok = false;
			try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
			if (ok) { showToast("已复制"); return; }
			if (text && navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () { showToast("已复制"); }).catch(function () { showToast("复制失败"); });
			} else if (text) {
				// captured into ownClipboard anyway — our own paste will work
				showToast("已复制");
			} else {
				showToast("复制失败");
			}
		}
		function doCut() {
			var el = ctxEditable;
			if (!el || editableSelectionLength(el) <= 0) return;
			focusCtxEditable();
			restoreSelection();
			try { document.execCommand("cut"); } catch (e) { /* ignore */ }
		}
		// Refocus the editable that was active when the menu opened and restore
		// its caret/selection (menu buttons steal focus, so activeElement is
		// no longer the input by the time an action runs).
		function focusCtxEditable() {
			if (!ctxEditable) return;
			try { ctxEditable.focus({ preventScroll: true }); } catch (e) { ctxEditable.focus(); }
			if (ctxSelStart >= 0) {
				try { ctxEditable.setSelectionRange(ctxSelStart, ctxSelEnd >= 0 ? ctxSelEnd : ctxSelStart); } catch (e) { /* ignore */ }
			}
		}
		function insertTextAtCaret(el, text) {
			if (el.isContentEditable) {
				try { document.execCommand("insertText", false, text); return; } catch (e) { /* fall through */ }
			}
			var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
			var desc = Object.getOwnPropertyDescriptor(proto, "value");
			var start = typeof el.selectionStart === "number" ? el.selectionStart : (el.value || "").length;
			var end = typeof el.selectionEnd === "number" ? el.selectionEnd : start;
			var next = (el.value || "").slice(0, start) + text + (el.value || "").slice(end);
			if (desc && desc.set) desc.set.call(el, next);
			else el.value = next;
			el.dispatchEvent(new Event("input", { bubbles: true }));
			var pos = start + text.length;
			try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
		}
		function doPaste() {
			// 0) 定位可编辑元素：菜单打开时快照的 ctxEditable 可能已因 React
			//    重渲染而失活（isConnected=false），失活则重新定位 composer。
			var el = ctxEditable;
			if (el && !el.isConnected) el = null;
			if (!el) {
				el = findComposer();
				if (el) { ctxEditable = el; ctxSelStart = -1; ctxSelEnd = -1; }
			}
			if (!el) { showToast("请先点击输入框再粘贴"); return; }
			focusCtxEditable();
			// 1) try execCommand paste synchronously (inside the click's user-activation window)
			var pasted = false;
			try { pasted = document.execCommand("paste"); } catch (e) { pasted = false; }
			if (pasted) return;
			// 2) execCommand 失败：用隐藏 textarea 同步读系统剪贴板（用户手势内，
			//    绕过 readText 的 clipboard-read 权限门——外部复制的内容也能读到）
			var viaPaste = readSystemClipboardViaPaste();
			if (viaPaste) {
				ownClipboard = viaPaste; // 同步记忆，后续粘贴直接可用
				focusCtxEditable(); // 焦点回到目标元素再插入
				insertTextAtCaret(el, viaPaste);
				return;
			}
			// 3) 仍失败：用本插件记忆的剪贴板兜底（本插件复制过的内容）
			if (ownClipboard) { insertTextAtCaret(el, ownClipboard); return; }
			// 4) 最后尝试异步 readText（受 clipboard-read 权限限制，尽力而为）
			if (navigator.clipboard && navigator.clipboard.readText) {
				navigator.clipboard.readText().then(function (text) {
					if (text) insertTextAtCaret(el, text);
					else showToast("剪贴板为空");
				}).catch(function () {
					showToast("无法读取剪贴板，请用 Ctrl+V 粘贴");
				});
			} else {
				showToast("无法读取剪贴板，请用 Ctrl+V 粘贴");
			}
		}
		function doSelectAll() {
			var el = document.activeElement;
			if (isEditable(el)) {
				try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
				try { if (el.select) el.select(); else if (el.setSelectionRange) el.setSelectionRange(0, (el.value || "").length); } catch (e) { /* ignore */ }
				return;
			}
			// Reliable single-range selection over the conversation flow only
			// (message column, excluding sidebar/header/input). Multi-range
			// exclusion of per-message metadata is not rendered in this
			// Electron webview, so keep select-all simple.
			var container = document.querySelector('[data-chat-flow]')
				|| document.querySelector('[data-conversation-scroll]')
				|| document.querySelector('[data-pane="conversation"]')
				|| document.querySelector('[class*="centerCol"]')
				|| document.body;
			try {
				var sel = window.getSelection();
				sel.removeAllRanges();
				var r = document.createRange();
				r.selectNodeContents(container);
				sel.addRange(r);
				selectAllContainer = container;
				selectAllRows = null; // whole-flow mode
				selectAllActive = true; // mark so a following Ctrl+C gets cleaned
			} catch (e) { /* ignore */ }
		}
		// --- scoped select-all (当前消息 / 本轮对话) ---
		// Message rows are flat [data-chat-flow-kind] children of the flow
		// container (no per-turn wrapper element). Kinds:
		//   user/steering/context/command → user side
		//   assistant/assistant-step       → assistant side
		//   tool-call/turn-tail/...        → chrome, skipped for "current message"
		function flowRows() {
			var container = document.querySelector('[data-chat-flow]')
				|| document.querySelector('[data-conversation-scroll]')
				|| document.querySelector('[data-pane="conversation"]')
				|| document.querySelector('[class*="centerCol"]');
			return container ? Array.prototype.slice.call(container.querySelectorAll('[data-chat-flow-kind]')) : [];
		}
		function isUserKindRow(row) {
			var k = row.getAttribute("data-chat-flow-kind") || "";
			return k === "user" || k === "steering" || k === "context" || k === "command";
		}
		function isMessageKindRow(row) {
			return isUserKindRow(row) || (function () {
				var k = row.getAttribute("data-chat-flow-kind") || "";
				return k === "assistant" || k === "assistant-step";
			})();
		}
		function findMessageRow(target) {
			var node = target;
			var guard = 0;
			while (node && node !== document.body && guard < 12) {
				if (node.getAttribute && node.getAttribute("data-chat-flow-kind") !== null) return node;
				node = node.parentNode;
				guard++;
			}
			return null;
		}
		// Select one range covering rows[0]..rows[last] (single range is the
		// reliable path in this webview) and remember the rows for Ctrl+C.
		function selectMessageRows(rows) {
			if (!rows || rows.length === 0) { showToast("未找到消息"); return; }
			try {
				var sel = window.getSelection();
				sel.removeAllRanges();
				var r = document.createRange();
				r.setStartBefore(rows[0]);
				r.setEndAfter(rows[rows.length - 1]);
				sel.addRange(r);
				selectAllRows = rows;
				selectAllContainer = null; // row mode
				selectAllActive = true;
			} catch (e) { /* ignore */ }
		}
		function doSelectAllCurrent() {
			var row = findMessageRow(eTargetNode);
			if (!row || !isMessageKindRow(row)) { showToast("未找到消息"); return; }
			selectMessageRows([row]);
		}
		// 本轮对话 = from the nearest user-side row (including it) up to but
		// not including the next user-side row. Works even when the right-click
		// landed on a tool-call row inside the turn.
		function doSelectAllTurn() {
			var row = findMessageRow(eTargetNode);
			if (!row) { showToast("未找到消息"); return; }
			var rows = flowRows();
			if (rows.length === 0) { showToast("未找到对话"); return; }
			var idx = rows.indexOf(row);
			if (idx === -1) idx = 0;
			var start = idx;
			while (start > 0 && !isUserKindRow(rows[start])) start--;
			var end = start;
			while (end + 1 < rows.length && !isUserKindRow(rows[end + 1])) end++;
			selectMessageRows(rows.slice(start, end + 1));
		}
		// Copy the conversation as plain message text, skipping the per-turn
		// metadata blocks (deliverables 产物 / run-time + token chrome).
		// Extract conversation text. By default skips per-turn metadata
		// (deliverables / run-time + token chrome) and tool-call/think blocks.
		// When keepRange is provided, an excluded block that intersects that
		// range is KEPT (so a user-selected think/tool block survives a
		// follow-up select-all + copy). Returns { text, kept, dropped } so the
		// caller can surface diagnostics.
		function conversationCleanText(container, keepToolCalls, keepRange) {
			var EXCLUDED = '[data-variant="think"],[data-tool],[data-chat-call-id],[data-chat-anchor-key^="call:"],[data-turn-tail],[data-produced-files-row]';
			if (keepToolCalls) {
				EXCLUDED = '[data-turn-tail],[data-produced-files-row]';
			}
			var excludedEl = function (n) {
				var p = n.parentElement;
				while (p && p !== container) {
					if (p.matches && p.matches(EXCLUDED)) return p;
					p = p.parentElement;
				}
				return null;
			};
			var parts = [];
			var seen = {};
			var kept = 0, dropped = 0;
			var walker = document.createTreeWalker(container, 4); // SHOW_TEXT
			var node;
			while ((node = walker.nextNode())) {
				if (!node.nodeValue || node.nodeValue.trim() === "") continue;
				var block = excludedEl(node);
				if (block !== null) {
					var key = block.getAttribute ? (block.getAttribute(ROOT_ATTR + "-seen") || block.tagName + ":" + (block.getAttribute("data-tool") || block.getAttribute("data-variant") || block.getAttribute("data-chat-call-id") || "")) : "";
					if (!seen[key]) { seen[key] = true; }
					if (!keepRange) { dropped++; continue; }
					var intersects = false;
					try { intersects = keepRange.intersectsNode(block); } catch (e) { /* ignore */ }
					if (!intersects) { dropped++; continue; }
					kept++;
				}
				parts.push(node.nodeValue);
			}
			return {
				text: parts.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
				kept: kept,
				dropped: dropped,
				kinds: Object.keys(seen)
			};
		}
		function copyConversation() {
			var container = document.querySelector('[data-chat-flow]')
				|| document.querySelector('[data-conversation-scroll]')
				|| document.querySelector('[data-pane="conversation"]')
				|| document.querySelector('[class*="centerCol"]')
				|| document.body;
			try {
				var res = conversationCleanText(container, false, savedRange);
				writeClipboard(res.text ? res.text : "(无可复制内容)");
			} catch (e) {
				showToast("复制失败");
			}
		}

		// ------------------------------------------------------------------
		// export conversation (Markdown / JSON / PDF) with custom role labels
		// ------------------------------------------------------------------
		// Find the chat flow container (shared with copyConversation).
		function chatContainer() {
			return document.querySelector('[data-chat-flow]')
				|| document.querySelector('[data-conversation-scroll]')
				|| document.querySelector('[data-pane="conversation"]')
				|| document.querySelector('[class*="centerCol"]')
				|| document.body;
		}
		// Extract the plain text of one message row, skipping its think /
		// tool-call / metadata blocks so exports stay clean.
		function rowCleanText(row) {
			var parts = [];
			var walker = document.createTreeWalker(row, 4); // SHOW_TEXT
			var node;
			while ((node = walker.nextNode())) {
				if (!node.nodeValue || node.nodeValue.trim() === "") continue;
				var p = node.parentElement;
				var skip = false;
				while (p && p !== row) {
					if (p.matches && (p.matches('[data-variant="think"]') || p.matches('[data-tool]') || p.matches('[data-chat-call-id]') || p.matches('[data-chat-anchor-key^="call:"]') || p.matches('[data-turn-tail]') || p.matches('[data-produced-files-row]'))) { skip = true; break; }
					p = p.parentElement;
				}
				if (skip) continue;
				parts.push(node.nodeValue);
			}
			return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
		}
		// Build the structured message list from the chat flow DOM.
		// kind values observed in the conversation DOM:
		//   user / steering / context / command  → user role
		//   assistant / assistant-step            → assistant role
		//   tool-call / turn-tail / turn-error / turn-max-tokens / unknown → skip
		// The chat flow is paginated ("加载更早"), so first we auto-load all
		// older pages until the whole conversation is in the DOM.
		function findLoadOlderButton() {
			var container = chatContainer();
			if (!container) return null;
			var btns = container.querySelectorAll("button");
			for (var i = 0; i < btns.length; i++) {
				var t = (btns[i].textContent || "").trim();
				if (t === "加载更早" || t === "Load earlier" || t.indexOf("加载更早") !== -1 || t.indexOf("Load earlier") !== -1) return btns[i];
			}
			return null;
		}
		function waitMs(ms) {
			return new Promise(function (resolve) { setTimeout(resolve, ms); });
		}
		// Repeatedly click "加载更早" until the full history is loaded (cap loops).
		async function loadAllHistory() {
			var maxLoops = 60;
			for (var i = 0; i < maxLoops; i++) {
				var btn = findLoadOlderButton();
				if (!btn) break;
				if (btn.disabled) { await waitMs(500); continue; }
				btn.click();
				await waitMs(600);
			}
		}
		async function exportConversation() {
			var container = chatContainer();
			if (!container) { showToast("未找到对话内容"); return null; }
			await loadAllHistory();
			// re-query after history has been loaded into the DOM
			var rows = Array.prototype.slice.call(container.querySelectorAll('[data-chat-flow-kind]'));
			if (rows.length === 0) { showToast("未找到对话内容"); return null; }
			var settings = loadSettings();
			var items = [];
			for (var i = 0; i < rows.length; i++) {
				var kind = rows[i].getAttribute("data-chat-flow-kind") || "";
				var role = null;
				if (kind === "user" || kind === "steering" || kind === "context" || kind === "command") role = "user";
				else if (kind === "assistant" || kind === "assistant-step") role = "assistant";
				else continue; // tool-call / turn-tail / errors / unknown
				var text = rowCleanText(rows[i]);
				if (!text) continue;
				items.push({
					role: role,
					display: role === "user" ? (settings.userLabel || "用户") : (settings.assistantLabel || "助手"),
					text: text
				});
			}
			if (items.length === 0) { showToast("无可导出内容"); return null; }
			return items;
		}
		function safeFilename(base) {
			var s = String(base || "").replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 60);
			return s || "对话导出";
		}
		var downloadBusy = false;
		function downloadBlob(filename, mime, content) {
			// This Electron wrapper's download manager fires TWO save dialogs
			// for any <a download> (one correct, one saving the URL as a
			// "blob"/"data链接" file). First is the real file — guide the user.
			if (downloadBusy) return;
			downloadBusy = true;
			try {
				var href = "data:" + mime + "," + encodeURIComponent(content);
				var a = document.createElement("a");
				a.href = href;
				a.download = filename;
				a.click();
				setTimeout(function () { downloadBusy = false; }, 2000);
				showToast("已导出 " + filename + "（Electron 会弹两次保存框：请用第一个，关闭第二个）", 6);
			} catch (e) {
				downloadBusy = false;
				showToast("导出失败");
			}
		}
		// Unified export flow for Markdown/JSON:
		//  1. open the save dialog FIRST (inside the click's user-activation
		//     window) so File System Access API is permitted and only ONE
		//     dialog appears (avoids Electron's blob double-download),
		//  2. load the full history + build content,
		//  3. write to the picked file, or fall back to <a download>.
		var exportBusy = false;
		function buildMarkdown(items) {
			var lines = [];
			for (var i = 0; i < items.length; i++) {
				lines.push("## " + items[i].display);
				lines.push("");
				lines.push(items[i].text);
				lines.push("");
			}
			return lines.join("\n").trim() + "\n";
		}
		function buildJson(items) {
			return JSON.stringify(items.map(function (it) {
				return { role: it.role, displayName: it.display, content: it.text };
			}), null, 2);
		}
		// Unified export flow for Markdown/JSON.
		// This Electron wrapper has no File System Access API and its download
		// manager fires TWO save dialogs for any <a download>. We accept that
		// limitation (the first dialog is the real file) and surface a toast
		// telling the user to use the first dialog and close the second.
		async function exportFlow(kind) {
			if (exportBusy) return;
			exportBusy = true;
			// Show the "exporting" toast FIRST and keep it visible (0 = no
			// auto-dismiss) until the save dialogs appear.
			showToast("正在导出…", 0);
			try {
				var name = safeFilename(document.title) + (kind === "md" ? ".md" : ".json");
				var mime = kind === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";
				var items = await exportConversation();
				if (!items) { exportBusy = false; return; }
				var content = kind === "md" ? buildMarkdown(items) : buildJson(items);
				downloadBlob(name, mime, content);
			} catch (e) {
				showToast("导出失败");
			} finally {
				exportBusy = false;
			}
		}
		// PDF: build a print-only overlay, call window.print(), clean up after.
		var printLayer = null;
		var printStyleTag = null;
		function cleanupPrintLayer() {
			if (printLayer) { printLayer.remove(); printLayer = null; }
			if (printStyleTag) { printStyleTag.remove(); printStyleTag = null; }
		}
		function exportToPdf(items) {
			cleanupPrintLayer();
			var title = safeFilename(document.title);
			var parts = [];
			parts.push("<h1>" + escapeHtml(title) + "</h1>");
			for (var i = 0; i < items.length; i++) {
				parts.push("<div class=\"dsh-export-block\"><div class=\"dsh-export-role\">" + escapeHtml(items[i].display) + "</div><div class=\"dsh-export-text\">" + escapeHtml(items[i].text).replace(/\n/g, "<br>") + "</div></div>");
			}
			printLayer = document.createElement("div");
			printLayer.className = "dsh-export-print";
			printLayer.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;overflow:auto;background:#fff;color:#1f2328;z-index:2147483647;padding:32px;box-sizing:border-box;font-family:-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;";
			printLayer.innerHTML = parts.join("");
			document.body.appendChild(printLayer);
			printStyleTag = document.createElement("style");
			printStyleTag.textContent = "@media print { body * { visibility: hidden !important; } .dsh-export-print, .dsh-export-print * { visibility: visible !important; } .dsh-export-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; padding: 24px !important; } .dsh-export-block { margin-bottom: 16px; page-break-inside: avoid; } .dsh-export-role { font-weight: 600; margin-bottom: 4px; } .dsh-export-text { white-space: normal; word-break: break-word; } }";
			document.head.appendChild(printStyleTag);
			// Clean up after the print dialog closes (afterprint) with a safety timeout.
			var cleaned = false;
			var doCleanup = function () {
				if (cleaned) return;
				cleaned = true;
				window.removeEventListener("afterprint", doCleanup);
				cleanupPrintLayer();
			};
			window.addEventListener("afterprint", doCleanup);
			window.print();
			setTimeout(doCleanup, 30000); // safety net if afterprint never fires
		}
		function escapeHtml(s) {
			return String(s).replace(/[&<>"']/g, function (c) {
				return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
			});
		}

		// ------------------------------------------------------------------
		// web search
		// ------------------------------------------------------------------
		function webSearch(text) {
			var settings = loadSettings();
			window.open(engineUrl(settings, text), "_blank", "noopener");
		}
		function openSite(siteId, text) {
			var site = SITES[siteId];
			if (!site) return;
			window.open(site.url(text), "_blank", "noopener");
		}
		// DeepL 网页版不支持通过 URL 预填待译文本（hash 里的 #auto/zh/… 只显示
		// 在地址栏、翻译框不会自动填入）。流程：先把文本复制进剪贴板 → 弹出
		// 居中提醒（非底部 toast）→ 用户点「前往 DeepL」后同步打开翻译器主页，
		// 到页面里 Ctrl+V 粘贴即可翻译。
		function openDeepl(text) {
			var base = SITES.deepl.url();
			var go = function () {
				// must run synchronously inside the click stack, or the popup
				// blocker swallows window.open
				window.open(base, "_blank", "noopener");
			};
			if (!text) { go(); return; }

			// Show the modal IMMEDIATELY (synchronously) — never gate it behind
			// the clipboard promise: in this Electron webview that promise can
			// hang forever (clipboard permission issues), which previously made
			// the dialog silently never appear. Clipboard write runs in the
			// background and only updates the dialog's status text.
			var statusEl = null;
			showModal({
				title: "即将打开 DeepL",
				body: "正在复制到剪贴板…",
				cancelText: "取消",
				okText: "前往 DeepL",
				onOk: go,
				onBody: function (el) { statusEl = el; }
			});

			// Background clipboard write; update status text when it settles.
			var done = function (ok) {
				if (statusEl) {
					statusEl.textContent = ok
						? "文本已复制到剪贴板。\n\nDeepL 网页版不支持自动填入，请点击「前往 DeepL」，在翻译器输入框中按 Ctrl+V 粘贴后翻译。"
						: "无法复制文本到剪贴板。\n\n请点击「前往 DeepL」，手动复制文本后粘贴翻译。";
				}
			};
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () {
					ownClipboard = text;
					done(true);
				}).catch(function () {
					done(false);
				});
			} else {
				// fallback: hidden textarea + execCommand
				try {
					var ta = document.createElement("textarea");
					ta.value = text;
					ta.style.cssText = "position:fixed;left:-9999px;top:0;";
					document.body.appendChild(ta);
					ta.select();
					document.execCommand("copy");
					ta.remove();
					ownClipboard = text;
					done(true);
				} catch (e) {
					done(false);
				}
			}
		}

		// ------------------------------------------------------------------
		// agent search & quick actions — route the text into the composer
		// ------------------------------------------------------------------
		function findComposer() {
			var direct = document.querySelector("textarea[data-phase]");
			if (direct) return direct;
			var all = Array.prototype.slice.call(document.querySelectorAll("textarea"));
			for (var i = 0; i < all.length; i++) {
				if (all[i].offsetParent !== null) return all[i];
			}
			return null;
		}
		// React-controlled inputs ignore `el.value = x`; use the native setter so
		// React's value tracker is bypassed and the following 'input' event is
		// seen as a real change.
		function setNativeValue(el, value) {
			var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
			var desc = Object.getOwnPropertyDescriptor(proto, "value");
			if (desc && desc.set) desc.set.call(el, value);
			else el.value = value;
		}
		function fillComposer(textarea, text) {
			try { textarea.focus({ preventScroll: true }); } catch (e) { textarea.focus(); }
			setNativeValue(textarea, text);
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		}
		function submitWithEnter(textarea) {
			textarea.dispatchEvent(new KeyboardEvent("keydown", {
				key: "Enter", code: "Enter", keyCode: 13, which: 13,
				bubbles: true, cancelable: true
			}));
		}
		function tryClickSendButton() {
			var ta = findComposer();
			if (!ta || ta.readOnly || ta.disabled) return;
			if ((ta.value || "").trim() === "") return; // Enter already submitted
			var labels = ["发送", "Send"];
			for (var i = 0; i < labels.length; i++) {
				var btn = document.querySelector('button[aria-label="' + labels[i] + '"]');
				if (btn && !btn.disabled) { btn.click(); return; }
			}
		}
		// Shared: put `prompt` (already containing the text) into the composer;
		// auto-submit when enabled and the composer is idle.
		function sendToComposer(prompt) {
			var ta = findComposer();
			if (!ta) return false;
			var settings = loadSettings();
			fillComposer(ta, prompt);
			var locked = ta.readOnly || ta.disabled;
			if (settings.autoSubmit && !locked) {
				window.setTimeout(function () {
					var fresh = findComposer();
					if (!fresh || fresh.readOnly || fresh.disabled) return;
					submitWithEnter(fresh);
					window.setTimeout(tryClickSendButton, 180);
				}, 40);
			} else {
				try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
			}
			return true;
		}
		function agentSearch(text) {
			var settings = loadSettings();
			sendToComposer((settings.agentPrompt || DEFAULT_SETTINGS.agentPrompt).replace("{text}", text));
		}
		function agentAction(actionId, text) {
			var action = AGENT_ACTIONS[actionId];
			if (!action) return;
			sendToComposer(action.prompt.replace("{text}", text));
		}
		function looksLikeCode(text) {
			return /[{}();]|\b(function|def|class|const|let|var|if|return|import|export)\b/.test(text);
		}

		// ------------------------------------------------------------------
		// text tools
		// ------------------------------------------------------------------
		var toastEl = null;
		var toastTimer = null;
		function showToast(msg, seconds) {
			if (toastEl) toastEl.remove();
			toastEl = document.createElement("div");
			toastEl.setAttribute(ROOT_ATTR, "");
			toastEl.textContent = msg;
			toastEl.style.cssText = "position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:2147483647;background:var(--dsw-alias-bg-layer-3,#ffffff);color:var(--dsw-alias-label-primary,#1f2328);border:1px solid var(--dsw-alias-border-l2,#d0d7de);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.2);padding:8px 14px;font-size:13px;line-height:1.5;max-width:70vw;";
			document.body.appendChild(toastEl);
			var secs = seconds !== undefined ? seconds : (loadSettings().toastSeconds || 3);
			if (toastTimer) clearTimeout(toastTimer);
			if (secs > 0) {
				toastTimer = setTimeout(function () {
					if (toastEl) { toastEl.remove(); toastEl = null; }
				}, secs * 1000);
			}
		}
		// Centered modal dialog (e.g. DeepL copy reminder). Distinct from the
		// bottom toast — big, blocking, requires an explicit action.
		var modalEl = null;
		function showModal(opts) {
			hideModal();
			var mask = document.createElement("div");
			mask.setAttribute(ROOT_ATTR, "");
			mask.className = "dsh-mask";
			var dlg = document.createElement("div");
			dlg.className = "dsh-dialog";
			if (opts.title) {
				var title = document.createElement("div");
				title.className = "dsh-dialog-title";
				title.textContent = opts.title;
				dlg.append(title);
			}
			if (opts.body) {
				var body = document.createElement("div");
				body.className = "dsh-dialog-body";
				body.textContent = opts.body;
				dlg.append(body);
				if (opts.onBody) opts.onBody(body);
			}
			var actions = document.createElement("div");
			actions.className = "dsh-dialog-actions";
			if (opts.cancelText) {
				var cancel = document.createElement("button");
				cancel.type = "button";
				cancel.className = "dsh-btn dsh-btn-ghost";
				cancel.textContent = opts.cancelText;
				cancel.addEventListener("click", function (e) { e.stopPropagation(); hideModal(); if (opts.onCancel) opts.onCancel(); });
				actions.append(cancel);
			}
			if (opts.okText) {
				var ok = document.createElement("button");
				ok.type = "button";
				ok.className = "dsh-btn dsh-btn-primary";
				ok.textContent = opts.okText;
				ok.addEventListener("click", function (e) { e.stopPropagation(); hideModal(); if (opts.onOk) opts.onOk(); });
				actions.append(ok);
			}
			dlg.append(actions);
			// click on the mask (outside the dialog) dismisses, like cancel
			mask.addEventListener("pointerdown", function (e) {
				if (e.target === mask) { hideModal(); if (opts.onCancel) opts.onCancel(); }
			});
			mask.append(dlg);
			document.body.appendChild(mask);
			modalEl = mask;
		}
		function hideModal() {
			if (modalEl) { modalEl.remove(); modalEl = null; }
		}
		function countStats(text) {
			var chars = text.replace(/\s/g, "").length;
			var words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
			var lines = text.split("\n").filter(function (l) { return l.trim() !== ""; }).length;
			showToast("字符(不含空白): " + chars + " · 词数: " + words + " · 行数: " + lines);
		}
		function writeClipboard(text, toastMsg) {
			if (text) ownClipboard = text; // remember for in-plugin paste fallback
			var okMsg = toastMsg || "已复制";
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () {
					showToast(okMsg);
				}).catch(function () {
					showToast("复制失败");
				});
				return;
			}
			// fallback
			try {
				var ta = document.createElement("textarea");
				ta.value = text;
				ta.style.cssText = "position:fixed;left:-9999px;top:0;";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				ta.remove();
				showToast(okMsg);
			} catch (e) {
				showToast("复制失败");
			}
		}
		function copyQuote(text) {
			var quoted = text.split("\n").map(function (l) { return "> " + l; }).join("\n");
			writeClipboard(quoted);
		}
		function copyPlain(text) {
			writeClipboard(text);
		}
		function copyList(text) {
			var list = text.split("\n").filter(function (l) { return l.trim() !== ""; }).map(function (l) { return "- " + l.trim(); }).join("\n");
			writeClipboard(list);
		}
		function copyCodeBlock(text) {
			writeClipboard("```\n" + text + "\n```");
		}
		function copyInlineCode(text) {
			writeClipboard("`" + text + "`");
		}
		function transformCase(mode) {
			var el = ctxEditable;
			if (!el || editableSelectionLength(el) <= 0) return;
			focusCtxEditable();
			var start = el.selectionStart, end = el.selectionEnd;
			if (typeof start !== "number") start = ctxSelStart >= 0 ? ctxSelStart : 0;
			if (typeof end !== "number") end = ctxSelEnd >= 0 ? ctxSelEnd : start;
			var val = el.value || "";
			var sel = val.slice(start, end);
			var out = sel;
			if (mode === "upper") out = sel.toUpperCase();
			else if (mode === "lower") out = sel.toLowerCase();
			else if (mode === "title") out = sel.replace(/(^|\s|[-_(\[])(\p{L})/gu, function (m, pre, ch) { return pre + ch.toUpperCase(); });
			var next = val.slice(0, start) + out + val.slice(end);
			var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
			var desc = Object.getOwnPropertyDescriptor(proto, "value");
			if (desc && desc.set) desc.set.call(el, next);
			else el.value = next;
			el.dispatchEvent(new Event("input", { bubbles: true }));
			try { el.setSelectionRange(start, start + out.length); } catch (e) { /* ignore */ }
			showToast("已转换");
		}

		// ------------------------------------------------------------------
		// clipboard extras (message / title+link)
		// ------------------------------------------------------------------
		function findMessageUnder(target) {
			var node = target;
			var guard = 0;
			while (node && node !== document.body && guard < 8) {
				var txt = "";
				if (node && node.innerText) txt = node.innerText.trim();
				if (txt.length > 4 && /[\u4e00-\u9fff]|\w{4,}/.test(txt) && node.childElementCount > 0) {
					// likely a message bubble: grab its full text, but avoid huge containers
					if (txt.length <= 12000) return txt;
				}
				node = node.parentNode;
				guard++;
			}
			return "";
		}
		function copyCurrentMessage(target) {
			var txt = findMessageUnder(target);
			if (!txt) { showToast("未找到消息"); return; }
			writeClipboard(txt);
		}

		// ------------------------------------------------------------------
		// context menu
		// ------------------------------------------------------------------
		var ROOT_ATTR = "data-dsh-desktop-context-menu";
		var bar = null;
		var settingsPanel = null;
		var settingsOpen = false;
		var subpanel = null; // currently open flyout submenu (panel name, e.g. "copy")
		var submenuTimer = null; // hover-close delay for the flyout submenu
		var dragState = null;
		var selectAllActive = false; // true right after our 全选, cleared on any manual pointer interaction
		var selectAllContainer = null; // conversation container used by the last 全选 (whole-flow mode)
		var selectAllRows = null; // message rows selected by 当前消息/本轮对话 (row mode)
		var copyRewriting = false; // guards against re-entrant copy (clipboard fallback uses execCommand)
		var ctxText = ""; // selection text captured at menu-open time
		var ctxEditable = null; // editable element focused at menu-open time (buttons steal focus on click)
		var ctxSelStart = -1, ctxSelEnd = -1; // its caret/selection snapshot

		function closeSubpanel() {
			if (submenuTimer) { clearTimeout(submenuTimer); submenuTimer = null; }
			if (subpanel) { subpanel.remove(); subpanel = null; }
		}
		function scheduleSubpanelClose() {
			if (submenuTimer) clearTimeout(submenuTimer);
			submenuTimer = setTimeout(closeSubpanel, 220);
		}
		function cancelSubpanelClose() {
			if (submenuTimer) { clearTimeout(submenuTimer); submenuTimer = null; }
		}
		function hide() {
			settingsOpen = false;
			if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
			closeSubpanel();
			dragState = null;
			if (bar) { bar.remove(); bar = null; }
		}
		// After running an action: menu mode closes, dock mode persists.
		function dismiss() {
			if (loadSettings().toolbar === "dock") return;
			hide();
		}
		// One menu item: [icon] [label] [▸]. Every menu entry across the main
		// menu, flyouts, and settings panel uses this exact structure so icons
		// and text align identically everywhere.
		function makeButton(label, cls, disabled, onClick, icon, arrow) {
			var b = document.createElement("button");
			b.type = "button";
			b.className = "dsh-mi";
			if (disabled) b.disabled = true;
			var ic = document.createElement("span");
			ic.className = "dsh-ic";
			ic.textContent = icon || "";
			var lb = document.createElement("span");
			lb.className = "dsh-lb";
			lb.textContent = label;
			b.append(ic, lb);
			if (arrow) {
				var ar = document.createElement("span");
				ar.className = "dsh-ar";
				ar.textContent = "▸";
				b.append(ar);
			}
			b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
			b.addEventListener("click", function (e) {
				e.stopPropagation();
				if (b.disabled) return;
				try { onClick(b, e); } catch (err) { /* never break the page */ }
			});
			return b;
		}
		function sep() {
			var d = document.createElement("div");
			d.className = "dsh-sep";
			return d;
		}

		function show(x, y, text) {
			hide();
			saveSelection();
			ctxText = text;
			// snapshot the editable element + caret at menu-open time, because
			// clicking any menu button steals focus before an action runs.
			var activeEl = document.activeElement;
			ctxEditable = isEditable(activeEl) ? activeEl : null;
			if (ctxEditable && typeof ctxEditable.selectionStart === "number") {
				ctxSelStart = ctxEditable.selectionStart;
				ctxSelEnd = ctxEditable.selectionEnd;
			} else {
				ctxSelStart = -1;
				ctxSelEnd = -1;
			}
			var editable = isEditable(activeEl);
			var hasSel = hasAnySelection();
			var settings = loadSettings();

			bar = document.createElement("div");
			bar.setAttribute(ROOT_ATTR, "");
			bar.className = "dsh-m";
			bar.style.cssText = [
				"position:fixed",
				"left:" + Math.round(x) + "px",
				"top:" + Math.round(y) + "px",
				"z-index:2147483647",
				"min-width:200px",
				"max-height:80vh",
				"overflow-y:auto"
			].join(";") + ";";

			var itemCls = "";

			// draggable header handle (≡  ✕)
			var header = document.createElement("div");
			header.setAttribute(ROOT_ATTR + "-header", "");
			header.className = "dsh-hdr";
			var grip = document.createElement("span");
			grip.textContent = "≡";
			grip.className = "dsh-grip";
			// plain flat ✕ — flat look, but keeps its button affordance
			// (hand cursor + subtle hover feedback via .dsh-x)
			var close = document.createElement("button");
			close.type = "button";
			close.textContent = "✕";
			close.className = "dsh-x";
			close.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
			close.addEventListener("click", function (e) { e.stopPropagation(); hide(); });
			header.append(grip, close);
			header.addEventListener("pointerdown", startDrag);
			header.addEventListener("pointermove", onDragMove);
			header.addEventListener("pointerup", endDrag);
			header.addEventListener("pointercancel", endDrag);
			bar.append(header);

			// editing actions
			bar.append(
				makeButton("剪切", itemCls, !(editable && editableSelectionLength(document.activeElement) > 0), function () { doCut(); dismiss(); }),
				makeButton("复制", itemCls, !hasSel, function () { doCopy(); dismiss(); }),
				makeButton("粘贴", itemCls, !editable, function () { doPaste(); dismiss(); }),
				primarySubmenuButton("全选", itemCls, false, "selectall", function () { doSelectAllPrimary(); dismiss(); }, "", true),
				submenuButton("复制为", itemCls, text === "", "copy", "📋", true)
			);

			// main search + agent
			if (text !== "") {
				bar.append(sep());
				bar.append(
					makeButton("快捷搜索", itemCls, false, function () { webSearch(text); dismiss(); }, "🔍"),
					makeButton("Agent 搜索", itemCls, !findComposer(), function () { agentSearch(text); dismiss(); }, "🤖")
				);
			}

			// text tools
			if (text !== "" && settings.showTextTools) {
				bar.append(sep());
				// Agent quick actions exist (at least one enabled & applicable)?
				var hasAction = false;
				for (var aid in AGENT_ACTIONS) {
					if (settings.agentActions[aid] === false) continue;
					var act = AGENT_ACTIONS[aid];
					if (act.codeOnly && !looksLikeCode(text)) continue;
					hasAction = true;
					break;
				}
				// collect then append so `null` never reaches append()
				var toolButtons = [
					makeButton("字数统计", itemCls, false, function () { countStats(text); dismiss(); }, "📊"),
					submenuButton("大小写", itemCls, !(editable && editableSelectionLength(document.activeElement) > 0), "case", "🔠", true),
					hasAction ? submenuButton("Agent 动作", itemCls, !findComposer(), "actions", "🧩", true) : null
				];
				for (var ti = 0; ti < toolButtons.length; ti++) {
					if (toolButtons[ti]) bar.append(toolButtons[ti]);
				}
			}

			// translate + more sites
			if (text !== "" && settings.showSites) {
				bar.append(sep());
				bar.append(
					submenuButton("翻译", itemCls, false, "translate", "🌐", true),
					submenuButton("站内搜索", itemCls, false, "sites", "🧭", true)
				);
			}

			// clipboard extras (always)
			bar.append(sep());
			bar.append(
				makeButton("复制整条消息", itemCls, text === "", function () { copyCurrentMessage(eTargetNode); dismiss(); }, "📋"),
				submenuButton("导出对话", itemCls, false, "export", "📤", true),
				makeButton("设置", itemCls, false, function (b) { toggleSettings(b); }, "⚙")
			);

			document.body.appendChild(bar);
			// flip up/left when near the edge
			var est = bar.getBoundingClientRect();
			if (est.bottom > window.innerHeight - 8) {
				bar.style.top = Math.max(8, Math.round(y) - est.height - 10) + "px";
			}
			if (est.right > window.innerWidth - 8) {
				bar.style.left = Math.max(8, Math.round(x) - est.width) + "px";
			}
		}

		// flyout submenu (▸ items open a panel beside the trigger button)
		function openSubpanel(which, trigger) {
			if (!bar) return;
			if (subpanel && subpanel.dataset.panel === which) { cancelSubpanelClose(); return; }
			closeSubpanel();
			// avoid two flyouts overlapping: opening a submenu closes settings
			if (settingsOpen) { settingsOpen = false; if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; } }
			var settings = loadSettings();
			var text = ctxText; // snapshot from right-click time
			var panel = document.createElement("div");
			panel.setAttribute(ROOT_ATTR, "");
			panel.dataset.panel = which;
			panel.className = "dsh-m";
			panel.style.cssText = "position:fixed;z-index:2147483646;min-width:180px;";
			var subCls = "";

			if (which === "actions") {
				for (var aid in AGENT_ACTIONS) {
					if (settings.agentActions[aid] === false) continue;
					var action = AGENT_ACTIONS[aid];
					if (action.codeOnly && !looksLikeCode(text)) continue;
					panel.append(makeButton(action.label, subCls, !findComposer(), (function (id) { return function () { agentAction(id, text); dismiss(); }; })(aid), action.icon));
				}
			} else if (which === "translate") {
				var gt = makeButton("Google 翻译", subCls, false, function () { openSite("gtranslate", text); dismiss(); }, "🌍");
				gt.title = SITES.gtranslate.desc; // hover 提示
				var dl = makeButton("DeepL", subCls, false, function () { openDeepl(text); dismiss(); }, "🌍");
				dl.title = SITES.deepl.desc; // hover 提示
				panel.append(gt, dl);
				panel.append(makeButton("翻译成中文", subCls, false, function () { agentAction("translateZh", text); dismiss(); }, "🌐"));
				panel.append(makeButton("翻译成英文", subCls, false, function () { agentAction("translateEn", text); dismiss(); }, "🌐"));
			} else if (which === "sites") {
				SITE_ORDER.forEach(function (sid) {
					var site = SITES[sid];
					var b = makeButton(site.label, subCls, false, function () { openSite(sid, text); dismiss(); }, "🔗");
					if (site.desc) b.title = site.desc; // hover 提示
					panel.append(b);
				});
			} else if (which === "copy") {
				panel.append(makeButton("Markdown 引用", subCls, false, function () { copyQuote(text); dismiss(); }, "💬"));
				panel.append(makeButton("纯文本", subCls, false, function () { copyPlain(text); dismiss(); }, "📄"));
				panel.append(makeButton("无序列表", subCls, false, function () { copyList(text); dismiss(); }, "•"));
				panel.append(makeButton("代码块", subCls, false, function () { copyCodeBlock(text); dismiss(); }, "```"));
				panel.append(makeButton("行内代码", subCls, false, function () { copyInlineCode(text); dismiss(); }, "`"));
			} else if (which === "selectall") {
				// 全选二级菜单：当前消息 / 本轮对话 / 所有消息
				var msgRow = findMessageRow(eTargetNode);
				var hasMsg = !!(msgRow && isMessageKindRow(msgRow));
				panel.append(makeButton("当前消息", subCls, !hasMsg, function () { doSelectAllCurrent(); dismiss(); }, "💬"));
				panel.append(makeButton("本轮对话", subCls, !msgRow, function () { doSelectAllTurn(); dismiss(); }, "🔄"));
				panel.append(makeButton("所有消息", subCls, false, function () { doSelectAll(); dismiss(); }, "🗒️"));
			} else if (which === "export") {
				panel.append(makeButton("Markdown (.md)", subCls, false, function () { exportFlow("md"); dismiss(); }, "📄"));
				panel.append(makeButton("JSON (.json)", subCls, false, function () { exportFlow("json"); dismiss(); }, "🧾"));
				panel.append(makeButton("PDF（打印另存）", subCls, false, function () { exportConversation().then(function (it) { if (it) exportToPdf(it); }); dismiss(); }, "📕"));
			} else if (which === "case") {
				panel.append(makeButton("大写", subCls, false, function () { transformCase("upper"); dismiss(); }, "🔠"));
				panel.append(makeButton("小写", subCls, false, function () { transformCase("lower"); dismiss(); }, "🔡"));
				panel.append(makeButton("首字母大写", subCls, false, function () { transformCase("title"); dismiss(); }, "🔤"));
			}
			// keep the flyout open while the pointer stays on it
			panel.addEventListener("mouseenter", cancelSubpanelClose);
			panel.addEventListener("mouseleave", scheduleSubpanelClose);
			subpanel = panel;
			document.body.appendChild(panel);
			// fly out to the right of the trigger item, aligned to its top;
			// flip to the left / upward when there is no room.
			var tr = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : bar.getBoundingClientRect();
			var est = panel.getBoundingClientRect();
			var left = tr.right + 4;
			var top = tr.top;
			if (left + est.width > window.innerWidth - 8) left = Math.max(8, tr.left - est.width - 4);
			if (top + est.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - est.height - 8);
			panel.style.left = left + "px";
			panel.style.top = top + "px";
		}
		function toggleSubpanel(which, trigger) {
			if (subpanel && subpanel.dataset.panel === which) { closeSubpanel(); return; }
			openSubpanel(which, trigger);
		}
		// ▸ button: hover opens, click toggles, mouse-leave schedules a close.
		function submenuButton(label, cls, disabled, which, icon, arrow) {
			var btn = makeButton(label, cls, disabled, function (b) { toggleSubpanel(which, b); }, icon, arrow);
			btn.addEventListener("mouseenter", function () { openSubpanel(which, btn); });
			btn.addEventListener("mouseleave", scheduleSubpanelClose);
			return btn;
		}
		// ▸ button whose CLICK runs an action directly (primary behavior), while
		// hover still opens the flyout for the full choices. Used by 全选 so the
		// top-level button is actionable (default = 当前消息), with the submenu
		// available on hover for explicit picks.
		function primarySubmenuButton(label, cls, disabled, which, onClick, icon, arrow) {
			var btn = makeButton(label, cls, disabled, function (b) { onClick(b); }, icon, arrow);
			btn.addEventListener("mouseenter", function () { openSubpanel(which, btn); });
			btn.addEventListener("mouseleave", scheduleSubpanelClose);
			return btn;
		}
		// Dispatch the top-level 全选 click per settings.selectAllPrimary.
		function doSelectAllPrimary() {
			var mode = loadSettings().selectAllPrimary || "current";
			if (mode === "all") doSelectAll();
			else if (mode === "turn") doSelectAllTurn();
			else doSelectAllCurrent();
		}

		// ------------------------------------------------------------------
		// settings popover (inline, inside the menu)
		// ------------------------------------------------------------------
		function fieldRow(labelText, control) {
			var row = document.createElement("label");
			row.className = "dsh-field";
			var lab = document.createElement("span");
			lab.textContent = labelText;
			lab.className = "dsh-lbl";
			row.append(lab, control);
			return row;
		}
		function makeSelect(options, value, onChange) {
			var s = document.createElement("select");
			s.className = "dsh-ctl";
			options.forEach(function (o) {
				var opt = document.createElement("option");
				opt.value = o.value;
				opt.textContent = o.label;
				if (o.value === value) opt.selected = true;
				s.append(opt);
			});
			s.addEventListener("change", function () { onChange(s.value); });
			return s;
		}
		function makeTextInput(value, onChange) {
			var input = document.createElement("input");
			input.type = "text";
			input.value = value;
			input.spellcheck = false;
			input.className = "dsh-ctl";
			input.addEventListener("change", function () { onChange(input.value); });
			return input;
		}
		function makeCheckbox(labelText, checked, onChange) {
			var wrap = document.createElement("label");
			wrap.className = "dsh-chk";
			var cb = document.createElement("input");
			cb.type = "checkbox";
			cb.checked = checked;
			cb.addEventListener("change", function () { onChange(cb.checked); });
			wrap.append(cb, document.createTextNode(labelText));
			return wrap;
		}
		function toggleSettings(trigger) {
			if (!bar) return;
			// click-to-enter: clicking ⚙ again closes it
			if (settingsOpen && settingsPanel) {
				settingsPanel.remove(); settingsPanel = null; settingsOpen = false;
				return;
			}
			closeSubpanel();
			var settings = loadSettings();

			var modeSelect = makeSelect([
				{ value: "replace", label: "替换原生菜单（默认）" },
				{ value: "floating", label: "同时显示原生菜单" }
			], settings.mode, function (v) { saveSettings({ mode: v }); });
			var toolbarSelect = makeSelect([
				{ value: "menu", label: "右键菜单（点外部即关闭，默认）" },
				{ value: "dock", label: "浮动工具条（可拖动驻留）" }
			], settings.toolbar, function (v) { saveSettings({ toolbar: v }); });
			var selectAllSelect = makeSelect([
				{ value: "current", label: "当前消息（默认）" },
				{ value: "turn", label: "本轮对话" },
				{ value: "all", label: "所有消息" }
			], settings.selectAllPrimary || "current", function (v) { saveSettings({ selectAllPrimary: v }); });
			var engineSelect = makeSelect([
				{ value: "bing", label: "Bing" },
				{ value: "baidu", label: "百度" },
				{ value: "google", label: "Google" },
				{ value: "duckduckgo", label: "DuckDuckGo" },
				{ value: "custom", label: "自定义 URL" }
			], settings.engine, function (v) { saveSettings({ engine: v }); });
			var customInput = makeTextInput(settings.customUrl, function (v) { saveSettings({ customUrl: v }); });
			var promptInput = makeTextInput(settings.agentPrompt, function (v) { saveSettings({ agentPrompt: v }); });
			var autoCheck = makeCheckbox("Agent 动作：空闲时自动发送给 Agent（关 = 仅预填输入框）", settings.autoSubmit, function (v) { saveSettings({ autoSubmit: v }); });
			var textToolsCheck = makeCheckbox("显示文本工具（统计/引用/大小写）", settings.showTextTools, function (v) { saveSettings({ showTextTools: v }); });
			var sitesCheck = makeCheckbox("显示翻译与站内搜索", settings.showSites, function (v) { saveSettings({ showSites: v }); });
			var toastInput = makeTextInput(String(settings.toastSeconds), function (v) {
				var n = parseInt(v, 10);
				if (isNaN(n)) n = 3;
				saveSettings({ toastSeconds: Math.max(1, Math.min(10, n)) });
			});
			var userLabelInput = makeTextInput(settings.userLabel || "用户", function (v) { saveSettings({ userLabel: v || "用户" }); });
			var assistantLabelInput = makeTextInput(settings.assistantLabel || "助手", function (v) { saveSettings({ assistantLabel: v || "助手" }); });
			// Agent action toggles
			var actionChecks = [];
			for (var aid in AGENT_ACTIONS) {
				(function (id) {
					actionChecks.push(makeCheckbox(AGENT_ACTIONS[id].label, settings.agentActions[id] !== false, function (v) {
						var patch = {};
						patch[id] = v;
						saveSettings({ agentActions: patch });
					}));
				})(aid);
			}

			settingsPanel = document.createElement("div");
			settingsPanel.setAttribute(ROOT_ATTR, "");
			settingsPanel.className = "dsh-m";
			settingsPanel.style.cssText = "position:fixed;z-index:2147483646;min-width:260px;max-height:80vh;overflow-y:auto;gap:8px;padding:8px;";
			var actionHeading = document.createElement("div");
			actionHeading.textContent = "Agent 快捷动作";
			actionHeading.className = "dsh-h";
			var panelFields = [
				fieldRow("菜单模式", modeSelect),
				fieldRow("形态", toolbarSelect),
				fieldRow("全选一级按钮行为", selectAllSelect),
				fieldRow("搜索引擎", engineSelect),
				settings.engine === "custom" ? fieldRow("自定义 URL（用 {q} 占位）", customInput) : null,
				fieldRow("Agent 提示语（{text} 为选中文本）", promptInput),
				autoCheck,
				sep(),
				textToolsCheck,
				sitesCheck,
				fieldRow("气泡时长（秒）", toastInput),
				sep(),
				fieldRow("导出：用户称呼", userLabelInput),
				fieldRow("导出：助手称呼", assistantLabelInput),
				sep(),
				actionHeading
			];
			for (var i = 0; i < panelFields.length; i++) {
				if (panelFields[i]) settingsPanel.append(panelFields[i]);
			}
			var actionWrap = document.createElement("div");
			actionWrap.className = "dsh-chks";
			for (var a = 0; a < actionChecks.length; a++) actionWrap.append(actionChecks[a]);
			settingsPanel.append(actionWrap);
			settingsOpen = true;
			document.body.appendChild(settingsPanel);
			// fly out to the right of the ⚙ button, aligned to its top
			var tr = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : bar.getBoundingClientRect();
			var est = settingsPanel.getBoundingClientRect();
			var left = tr.right + 4;
			var top = tr.top;
			if (left + est.width > window.innerWidth - 8) left = Math.max(8, tr.left - est.width - 4);
			if (top + est.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - est.height - 8);
			settingsPanel.style.left = left + "px";
			settingsPanel.style.top = top + "px";
		}

		// ------------------------------------------------------------------
		// drag support (pointer events on the header handle)
		// ------------------------------------------------------------------
		function startDrag(e) {
			if (!bar || e.button !== 0) return;
			var rect = bar.getBoundingClientRect();
			var subRect = subpanel ? subpanel.getBoundingClientRect() : null;
			var setRect = settingsPanel ? settingsPanel.getBoundingClientRect() : null;
			dragState = {
				x: e.clientX, y: e.clientY, left: rect.left, top: rect.top,
				subLeft: subRect ? subRect.left : null,
				subTop: subRect ? subRect.top : null,
				setLeft: setRect ? setRect.left : null,
				setTop: setRect ? setRect.top : null
			};
			try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
		}
		function onDragMove(e) {
			if (!dragState || !bar) return;
			var dx = e.clientX - dragState.x;
			var dy = e.clientY - dragState.y;
			var nx = dragState.left + dx;
			var ny = dragState.top + dy;
			nx = Math.max(4, Math.min(nx, window.innerWidth - bar.offsetWidth - 4));
			ny = Math.max(4, Math.min(ny, window.innerHeight - bar.offsetHeight - 4));
			bar.style.left = nx + "px";
			bar.style.top = ny + "px";
			// linked flyouts: settings panel and open submenu move with the menu,
			// using the menu's ACTUAL (clamped) displacement so relative
			// positions stay locked — up/down and left/right both follow.
			var barDx = nx - dragState.left;
			var barDy = ny - dragState.top;
			if (subpanel && dragState.subLeft !== null) {
				subpanel.style.left = (dragState.subLeft + barDx) + "px";
				subpanel.style.top = (dragState.subTop + barDy) + "px";
			}
			if (settingsPanel && dragState.setLeft !== null) {
				settingsPanel.style.left = (dragState.setLeft + barDx) + "px";
				settingsPanel.style.top = (dragState.setTop + barDy) + "px";
			}
		}
		function endDrag() {
			dragState = null;
		}

		// ------------------------------------------------------------------
		// event wiring
		// ------------------------------------------------------------------
		var eTargetNode = null; // node under the right-click, for message copy
		function isInsideBar(target) {
			var node = target;
			while (node && node !== document) {
				if (node.getAttribute && node.getAttribute(ROOT_ATTR) !== null) return true;
				node = node.parentNode;
			}
			return false;
		}
		function onContextMenu(e) {
			if (isInsideBar(e.target)) return; // right-click on our own menu
			eTargetNode = e.target;
			// right-click is a user gesture: best-effort refresh of the plugin
			// clipboard from the system clipboard before the user picks 粘贴
			syncFromSystemClipboard();
			var text = selectedText();
			var settings = loadSettings();
			if (settings.mode === "replace") {
				e.preventDefault();
				show(e.clientX, e.clientY, text);
			} else {
				// floating: keep the native menu; show ours only when there is a selection.
				if (text === "") return;
				show(e.clientX, e.clientY, text);
			}
		}
		function onPointerDown(e) {
			// any manual pointer interaction ends the "clean select-all copy" mode
			selectAllActive = false;
			selectAllRows = null;
			if (!bar || isInsideBar(e.target)) return;
			if (loadSettings().toolbar === "dock") {
				// dock persists: only close opened flyouts when clicking elsewhere
				closeSubpanel();
				if (settingsOpen) { settingsOpen = false; if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; } }
				return;
			}
			hide();
		}
		// Keep the plugin clipboard in sync with the system clipboard: any
		// copy/cut inside the page, any navigator.clipboard.writeText call,
		// and (best-effort) a read when the window regains focus.
		function syncOwnClipboard(text) {
			if (text) ownClipboard = text;
		}
		// Read the system clipboard synchronously via a hidden textarea +
		// execCommand("paste"). This bypasses the Async Clipboard API
		// permission gate: inside a user-activation window (menu click /
		// right-click) execCommand("paste") pastes the system clipboard into
		// the focused editable, which we then read back. Returns "" when
		// unavailable (no activation, empty clipboard, denied by the host).
		// CRITICAL: fully restores the previous active element + caret, so
		// callers' ctxEditable snapshot and focus are never corrupted.
		function readSystemClipboardViaPaste() {
			var prevActive = document.activeElement;
			var prevStart = -1, prevEnd = -1;
			if (prevActive && typeof prevActive.selectionStart === "number") {
				try { prevStart = prevActive.selectionStart; prevEnd = prevActive.selectionEnd; } catch (e) { /* ignore */ }
			}
			var savedRange = null;
			try {
				var sel = window.getSelection();
				if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
			} catch (e) { /* ignore */ }
			var ta = document.createElement("textarea");
			ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
			document.body.appendChild(ta);
			var text = "";
			try {
				ta.focus();
				var ok = document.execCommand("paste");
				if (ok) text = ta.value || "";
			} catch (e) { /* ignore */ }
			ta.remove();
			// restore focus + caret on the previous editable (and the plain
			// selection for non-editable contexts)
			try {
				if (prevActive && prevActive.isConnected) {
					prevActive.focus({ preventScroll: true });
					if (prevStart >= 0 && typeof prevActive.setSelectionRange === "function") {
						prevActive.setSelectionRange(prevEnd >= 0 ? prevEnd : prevStart, prevEnd >= 0 ? prevEnd : prevStart);
					}
				} else if (savedRange) {
					var s = window.getSelection();
					s.removeAllRanges();
					s.addRange(savedRange);
				}
			} catch (e) { /* ignore */ }
			return text;
		}
		function clipboardTextFromEvent(e) {
			try {
				if (e && e.clipboardData && e.clipboardData.getData) {
					var t = e.clipboardData.getData("text/plain");
					if (t) return t;
				}
			} catch (err) { /* ignore */ }
			try {
				var sel = window.getSelection();
				if (sel && sel.rangeCount > 0) return sel.toString();
			} catch (err) { /* ignore */ }
			return "";
		}
		function onCut(e) {
			syncOwnClipboard(clipboardTextFromEvent(e));
		}
		// When a copy happens while the selection was produced by our 全选,
		// rewrite the clipboard text without tool-call/think/metadata blocks.
		// A manual selection (pointer interaction clears selectAllActive)
		// copies whatever the user actually selected.
		function onCopy(e) {
			// sync plugin clipboard with what is being copied
			syncOwnClipboard(clipboardTextFromEvent(e));
			if (copyRewriting) return;
			if (!selectAllActive) return;
			var sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) return;
			// Row mode (当前消息/本轮对话): clean each selected row and join.
			if (selectAllRows && selectAllRows.length) {
				var parts = [];
				var dropped = 0, kept = 0;
				for (var i = 0; i < selectAllRows.length; i++) {
					var rr = conversationCleanText(selectAllRows[i], false, savedRange);
					if (rr.text) parts.push(rr.text);
					dropped += rr.dropped;
					kept += rr.kept;
				}
				var joined = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
				if (!joined) return;
				e.preventDefault();
				copyRewriting = true;
				var diag2 = "已复制（剔除 " + dropped + " 个工具/元数据块" + (kept > 0 ? "，保留 " + kept + " 个" : "") + "）";
				writeClipboard(joined, diag2);
				copyRewriting = false;
				return;
			}
			// Whole-flow mode: the original container clean.
			if (!selectAllContainer) return;
			// keep tool-call/think blocks that the user had manually selected
			// (savedRange from the right-click that opened the menu)
			var res = conversationCleanText(selectAllContainer, false, savedRange);
			if (!res.text) return;
			e.preventDefault();
			copyRewriting = true;
			// single toast: merge the "已复制" feedback with the cleanup diagnostic
			var diag = "已复制（剔除 " + res.dropped + " 个工具/元数据块" + (res.kept > 0 ? "，保留 " + res.kept + " 个" : "") + "）";
			writeClipboard(res.text, diag);
			copyRewriting = false;
			// selectAllActive stays until a manual pointer interaction clears it,
			// so repeated Ctrl+C keeps producing the same clean text.
		}
		// Best-effort: when the window regains focus, try to read the system
		// clipboard so external copies also sync into ownClipboard. Guarded
		// with a busy flag + timeout because the clipboard promise can hang
		// in this Electron webview (clipboard-read permission may be denied).
		var clipboardReadBusy = false;
		function syncFromSystemClipboard() {
			// Purely async readText with a busy flag + timeout. Never touches
			// focus/selection (the hidden-textarea trick would steal focus and
			// corrupt the menu's ctxEditable snapshot) — external copies are
			// read at paste time inside doPaste instead.
			if (clipboardReadBusy) return;
			if (!(navigator.clipboard && navigator.clipboard.readText)) return;
			clipboardReadBusy = true;
			var settled = false;
			var done = function () { if (!settled) { settled = true; clipboardReadBusy = false; } };
			var timer = setTimeout(done, 800); // never wait forever on a hanging promise
			navigator.clipboard.readText().then(function (text) {
				clearTimeout(timer);
				syncOwnClipboard(text);
				done();
			}).catch(function () {
				clearTimeout(timer);
				done();
			});
		}
		function onKeyDown(e) {
			if (e.key === "Escape") {
				if (modalEl) { hideModal(); return; }
				hide();
			}
		}
		function onScroll() {
			if (bar && loadSettings().toolbar !== "dock") hide();
		}

		function apply(ctx) {
			ctx.effect(function () {
				// Make per-message metadata blocks (deliverables, run-time +
				// token chrome) unselectable, so a single-range select-all
				// skips them in highlight and copy (Chromium respects
				// user-select:none in selection). This is more reliable than
				// multi-range exclusion in the Electron webview.
				var metaStyle = document.createElement("style");
				metaStyle.setAttribute(ROOT_ATTR + "-meta", "");
				metaStyle.textContent = [
					"[data-turn-tail], [data-turn-tail] *,",
					"[data-produced-files-row], [data-produced-files-row] * {",
					"  -webkit-user-select: none !important;",
					"  user-select: none !important;",
					"}"
				].join("\n");
				document.head.appendChild(metaStyle);

				// Shared menu styles: every item across the main menu, flyouts
				// and settings panel renders with the exact same layout
				// (fixed-width icon column, aligned text, hover, separator).
				var uiStyle = document.createElement("style");
				uiStyle.setAttribute(ROOT_ATTR + "-ui", "");
				uiStyle.textContent = [
					'[data-dsh-desktop-context-menu].dsh-m, [data-dsh-desktop-context-menu] .dsh-m {',
					'  display: flex; flex-direction: column; gap: 2px; padding: 6px;',
					'  background: var(--dsw-alias-bg-layer-3, #ffffff);',
					'  color: var(--dsw-alias-label-primary, #1f2328);',
					'  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);',
					'  border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.22);',
					'  font-size: 13px; line-height: 1.4; user-select: none; font-family: inherit;',
					'}',
					'[data-dsh-desktop-context-menu] .dsh-mi {',
					'  appearance: none; border: 0; background: transparent; color: inherit;',
					'  display: flex; align-items: center; gap: 8px; width: 100%;',
					'  min-height: 28px; padding: 0 10px; border-radius: 6px;',
					'  font: inherit; cursor: pointer; white-space: nowrap; text-align: left;',
					'  box-sizing: border-box;',
					'}',
					'[data-dsh-desktop-context-menu] .dsh-mi:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2, #f6f8fa); }',
					'[data-dsh-desktop-context-menu] .dsh-mi:disabled { opacity: .4; cursor: not-allowed; }',
					'[data-dsh-desktop-context-menu] .dsh-ic { flex: 0 0 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; }',
					'[data-dsh-desktop-context-menu] .dsh-lb { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }',
					'[data-dsh-desktop-context-menu] .dsh-ar { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, #6e7781); font-size: 11px; }',
					'[data-dsh-desktop-context-menu] .dsh-sep { height: 1px; background: var(--dsw-alias-border-l2, #d0d7de); margin: 4px 6px; }',
					'[data-dsh-desktop-context-menu] .dsh-hdr { display: flex; align-items: center; gap: 6px; padding: 2px 4px 4px; border-bottom: 1px solid var(--dsw-alias-border-l2, #d0d7de); margin-bottom: 4px; cursor: grab; user-select: none; touch-action: none; }',
					'[data-dsh-desktop-context-menu] .dsh-grip { color: var(--dsw-alias-label-tertiary, #6e7781); font-size: 14px; line-height: 1; }',
					'[data-dsh-desktop-context-menu] .dsh-x { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-tertiary, #6e7781); border-radius: 4px; padding: 2px 6px; font: 14px/1; cursor: pointer; margin-left: auto; }',
					'[data-dsh-desktop-context-menu] .dsh-x:hover { color: var(--dsw-alias-label-primary, #1f2328); }',
					'[data-dsh-desktop-context-menu] .dsh-field { display: flex; flex-direction: column; gap: 3px; }',
					'[data-dsh-desktop-context-menu] .dsh-lbl { color: var(--dsw-alias-label-secondary, #57606a); font-size: 12px; }',
					'[data-dsh-desktop-context-menu] .dsh-ctl { width: 100%; background: var(--dsw-alias-bg-layer-2, #f6f8fa); color: inherit; border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 6px; padding: 3px 6px; font: inherit; box-sizing: border-box; }',
					'[data-dsh-desktop-context-menu] .dsh-chk { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary, #57606a); font-size: 12px; cursor: pointer; }',
					'[data-dsh-desktop-context-menu] .dsh-chks { display: flex; flex-direction: column; gap: 4px; }',
					'[data-dsh-desktop-context-menu] .dsh-h { color: var(--dsw-alias-label-secondary, #57606a); font-size: 12px; font-weight: 600; margin-top: 2px; }',
					// modal (e.g. DeepL copy reminder) — centered overlay, high z-index.
					// mask itself carries the ROOT_ATTR, so the selector must match
					// the element AND its descendants (same fix as .dsh-m).
					'[data-dsh-desktop-context-menu].dsh-mask, [data-dsh-desktop-context-menu] .dsh-mask { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; }',
					'[data-dsh-desktop-context-menu] .dsh-dialog { width: 360px; max-width: 86vw; background: var(--dsw-alias-bg-layer-3, #ffffff); color: var(--dsw-alias-label-primary, #1f2328); border: 1px solid var(--dsw-alias-border-l2, #d0d7de); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.3); padding: 18px 20px; font-family: inherit; user-select: none; }',
					'[data-dsh-desktop-context-menu] .dsh-dialog-title { font-size: 14px; font-weight: 600; margin: 0 0 10px; }',
					'[data-dsh-desktop-context-menu] .dsh-dialog-body { font-size: 13px; line-height: 1.6; color: var(--dsw-alias-label-secondary, #57606a); margin: 0 0 16px; }',
					'[data-dsh-desktop-context-menu] .dsh-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }',
					'[data-dsh-desktop-context-menu] .dsh-btn { appearance: none; border: 0; border-radius: 6px; padding: 6px 14px; font: 13px/1.4 inherit; cursor: pointer; }',
					'[data-dsh-desktop-context-menu] .dsh-btn-primary { background: var(--dsw-alias-accent, #2f6feb); color: #fff; }',
					'[data-dsh-desktop-context-menu] .dsh-btn-primary:hover { filter: brightness(1.08); }',
					'[data-dsh-desktop-context-menu] .dsh-btn-ghost { background: transparent; color: var(--dsw-alias-label-secondary, #57606a); }',
					'[data-dsh-desktop-context-menu] .dsh-btn-ghost:hover { background: var(--dsw-alias-bg-layer-2, #f6f8fa); }'
				].join("\n");
				document.head.appendChild(uiStyle);

				document.addEventListener("contextmenu", onContextMenu, true);
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown, true);
				document.addEventListener("copy", onCopy, true);
				document.addEventListener("cut", onCut, true);
				window.addEventListener("scroll", onScroll, true);
				window.addEventListener("resize", onScroll);
				window.addEventListener("blur", onScroll);
				window.addEventListener("focus", syncFromSystemClipboard);
				// Any page code that writes the clipboard also syncs our
				// plugin clipboard (e.g. the app's own copy buttons).
				var origWriteText = navigator.clipboard && navigator.clipboard.writeText;
				if (typeof origWriteText === "function") {
					navigator.clipboard.writeText = function (text) {
						syncOwnClipboard(text);
						return origWriteText.call(navigator.clipboard, text);
					};
				}
				return function () {
					hide();
					if (metaStyle && metaStyle.parentNode) metaStyle.remove();
					if (uiStyle && uiStyle.parentNode) uiStyle.remove();
					if (origWriteText && navigator.clipboard) navigator.clipboard.writeText = origWriteText;
					document.removeEventListener("contextmenu", onContextMenu, true);
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown, true);
					document.removeEventListener("copy", onCopy, true);
					document.removeEventListener("cut", onCut, true);
					window.removeEventListener("scroll", onScroll, true);
					window.removeEventListener("resize", onScroll);
					window.removeEventListener("blur", onScroll);
					window.removeEventListener("focus", syncFromSystemClipboard);
				};
			});
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});
