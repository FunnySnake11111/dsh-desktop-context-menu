// dsh-desktop-context-menu — self-healing host patch module.
//
// DSH desktop ships with host behaviors that break useful renderer features:
//   1. navigation-policy:   renderer-requested http(s) popups / external
//      top-frame navigation are dropped → chat links and search sources never
//      reach the system browser.
//   2. renderer-permissions: only clipboard-sanitized-write is allowed →
//      navigator.clipboard.readText() is denied, so paste of externally
//      copied text fails in the renderer.
//
// This module carries the same user patches that the old apply-link-fix.ps1
// installed into app.asar (now extended to a general multi-file patch set),
// and re-applies them automatically whenever the host boots. After a desktop
// update overwrites app.asar, this self-heal restores every patch with no
// manual step.
//
// Design (mirrors dsh-deepseek-reasoning-patch):
//   * Pure Node (fs/path), zero external deps — runs in the host process.
//   * Idempotent: an app.asar already carrying the [user-patch] marker in all
//     patch targets is left untouched.
//   * Never throws; every failure is captured in the returned result and
//     logged, so the plugin tree can never be broken by a heal attempt.
//   * Backup-before-write + write verification + skip-on-mismatch.
//   * Only the in-asar patch targets are replaced; all other entries
//     (including every unpacked node_modules file) are preserved byte-for-byte
//     and re-serialized with the same @electron/asar pickle layout the
//     official reader expects.

import { copyFileSync, existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

/** Marker present in every patched file (idempotence + verification). */
const PATCH_MARKER = "[user-patch]";

/**
 * The patch set applied to app.asar. Each entry replaces one in-asar file:
 *   asarPath   — path inside the asar archive (src/…).
 *   patchFile  — the patched source shipped with this plugin.
 *   origFile   — the original source (fallback for undo when no backup).
 */
const PATCHES = [
	{
		id: "navigation-policy",
		asarPath: "src/navigation-policy.mjs",
		patchFile: fileURLToPath(new URL("./patches/navigation-policy.mjs", import.meta.url)),
		origFile: fileURLToPath(new URL("./patches/orig-navigation-policy.mjs", import.meta.url)),
	},
	{
		id: "renderer-permissions",
		asarPath: "src/renderer-permissions.mjs",
		patchFile: fileURLToPath(new URL("./patches/renderer-permissions.mjs", import.meta.url)),
		origFile: fileURLToPath(new URL("./patches/orig-renderer-permissions.mjs", import.meta.url)),
	},
];

/**
 * Locate the desktop app.asar.
 * Priority: explicit override -> Electron resourcesPath -> cwd heuristic ->
 * known local install. Returns null when none exists.
 */
export function locateAsar(override) {
	const candidates = [];
	const push = (value) => {
		if (typeof value === "string" && value.length > 0) candidates.push(value);
	};
	push(override);
	if (typeof process !== "undefined" && process.resourcesPath) {
		push(join(process.resourcesPath, "app.asar"));
	}
	if (typeof process !== "undefined" && process.cwd) {
		push(join(process.cwd(), "resources", "app.asar"));
	}
	// Known local install (this machine), last resort.
	push("D:\\Deepseek Harness\\DeepSeek Harness Desktop\\resources\\app.asar");
	for (const candidate of candidates) {
		try {
			const absolute = resolve(candidate);
			if (existsSync(absolute)) return absolute;
		} catch {}
	}
	return null;
}

/**
 * Parse the asar container and return the raw header JSON + content base
 * offset (the offset of the first file's content).
 */
function parseAsar(buf) {
	const headerStart = buf.indexOf("{", 8);
	let depth = 0, headerEnd = headerStart;
	for (let i = headerStart; i < buf.length; i++) {
		const c = buf[i];
		if (c === 0x7b) depth++;
		else if (c === 0x7d) { depth--; if (depth === 0) { headerEnd = i; break; } }
	}
	if (headerEnd === headerStart) throw new Error("cannot locate asar header");
	const header = JSON.parse(buf.subarray(headerStart, headerEnd + 1).toString("utf8"));
	const headerBufLen = buf.readUInt32LE(4);
	const contentBase = 8 + headerBufLen;
	if (contentBase % 4 !== 0) throw new Error(`contentBase not aligned: ${contentBase}`);
	return { header, contentBase };
}

/** Read one in-asar file's text ("" if absent). */
function readAsarFile(buf, asarPath) {
	const { header, contentBase } = parseAsar(buf);
	let out = "";
	const walk = (node, prefix) => {
		for (const [name, child] of Object.entries(node.files || {})) {
			const p = prefix ? `${prefix}/${name}` : name;
			if (child.files) { walk(child, p); continue; }
			if (child.unpacked === true || child.link !== undefined) continue;
			if (p === asarPath) {
				const offset = parseInt(child.offset, 10);
				out = buf.subarray(contentBase + offset, contentBase + offset + child.size).toString("utf8");
			}
		}
	};
	walk(header, "");
	return out;
}

/**
 * Rebuild an asar buffer with the given in-asar files replaced by patched
 * content. `replacements` is a map of asarPath -> new content string.
 * Preserves every other in-asar entry and every unpacked/link entry;
 * re-serializes with the exact @electron/asar pickle layout.
 */
export function rebuildAsar(srcBuf, replacements) {
	const { header, contentBase } = parseAsar(srcBuf);

	// Collect in-asar (non-unpacked, non-link) entries in header walk order.
	const inAsar = [];
	const walk = (node, prefix) => {
		for (const [name, child] of Object.entries(node.files || {})) {
			const p = prefix ? `${prefix}/${name}` : name;
			if (child.files) { walk(child, p); continue; }
			if (child.unpacked === true || child.link !== undefined) continue;
			const offset = parseInt(child.offset, 10);
			inAsar.push({
				path: p,
				size: child.size,
				offset,
				content: srcBuf.subarray(contentBase + offset, contentBase + offset + child.size),
				integrity: child.integrity,
				executable: child.executable === true,
			});
		}
	};
	walk(header, "");

	// Sanity: only package.json, src/* and runtime-support/* are in-asar
	// (matches the official app; v3.3.0 added runtime-support/community-plugin-known-issues.json).
	const unexpected = inAsar.filter((f) => f.path !== "package.json" && !f.path.startsWith("src/") && !f.path.startsWith("runtime-support/"));
	if (unexpected.length) {
		throw new Error(`unexpected in-asar files: ${unexpected.slice(0, 10).map((f) => f.path).join(", ")}`);
	}

	// Confirm offsets are sequential in header order (no de-dup).
	let expectedOffset = 0;
	for (const f of inAsar) {
		if (f.offset !== expectedOffset) throw new Error("in-asar offsets are not sequential");
		expectedOffset += f.size;
	}

	// Apply replacements.
	for (const [asarPath, newText] of Object.entries(replacements)) {
		let idx = -1;
		for (let i = 0; i < inAsar.length; i++) if (inAsar[i].path === asarPath) { idx = i; break; }
		if (idx === -1) throw new Error(`${asarPath} not found`);
		const patchedBuf = Buffer.from(newText, "utf8");
		inAsar[idx] = { ...inAsar[idx], content: patchedBuf, size: patchedBuf.length, integrity: undefined };
	}

	// New offsets in header walk order.
	const offsets = new Map();
	let cursor = 0;
	for (const f of inAsar) {
		offsets.set(f.path, cursor);
		cursor += f.size;
	}

	// Rebuild header tree, keeping unpacked/link leaves verbatim.
	const rebuild = (node, prefix) => {
		const files = {};
		for (const [name, child] of Object.entries(node.files || {})) {
			const p = prefix ? `${prefix}/${name}` : name;
			if (child.files) { files[name] = rebuild(child, p); continue; }
			if (child.unpacked === true || child.link !== undefined) { files[name] = child; continue; }
			const entry = inAsar.find((f) => f.path === p);
			if (!entry) throw new Error(`no entry for ${p}`);
			const leaf = { size: entry.size, offset: String(offsets.get(p)) };
			if (entry.executable) leaf.executable = true;
			if (entry.integrity) leaf.integrity = entry.integrity;
			files[name] = leaf;
		}
		return { files };
	};
	const newHeader = rebuild(header, "");

	// Serialize: sizePickle([4B payload=4][4B headerBuf.length]) + headerBuf([4B payloadSize][4B jsonLen][json][pad])
	const jsonStr = JSON.stringify(newHeader);
	const jsonLen = Buffer.byteLength(jsonStr, "utf8");
	const align4 = (n) => n + ((4 - (n % 4)) % 4);
	const payloadSize = align4(4 + jsonLen);
	const headerPayload = Buffer.alloc(payloadSize);
	headerPayload.writeInt32LE(jsonLen, 0);
	headerPayload.write(jsonStr, 4, jsonLen, "utf8");
	const headerBuf = Buffer.alloc(payloadSize + 4);
	headerBuf.writeUInt32LE(payloadSize, 0);
	headerPayload.copy(headerBuf, 4);
	const sizeBuf = Buffer.alloc(8);
	sizeBuf.writeUInt32LE(4, 0);
	sizeBuf.writeUInt32LE(headerBuf.length, 4);

	const parts = inAsar.map((f) => f.content);
	const newContent = Buffer.concat(parts);
	return Buffer.concat([sizeBuf, headerBuf, newContent]);
}

/**
 * Write `patched` bytes over app.asar (backup first, verify marker after).
 * Shared by selfHeal (patch) and unpatch (restore). Returns the backup path.
 */
function replaceAsar(asarPath, content) {
	const backup = `${asarPath}.bak-hostpatch-${Date.now()}`;
	copyFileSync(asarPath, backup);
	// Atomic-ish replace: write temp then rename over the original. On
	// Windows the running app may hold app.asar open; writeFileSync directly
	// (which we verified is permitted in this environment) as a fallback.
	const tmpPath = `${asarPath}.hostpatch.new`;
	try {
		writeFileSync(tmpPath, content);
		try {
			renameSync(tmpPath, asarPath);
		} catch {
			writeFileSync(asarPath, content);
			try { unlinkSync(tmpPath); } catch {}
		}
	} catch (writeError) {
		try { unlinkSync(tmpPath); } catch {}
		throw writeError;
	}
	return backup;
}

/** Find the most recent host-patch backup of app.asar (old linkfix + new hostpatch), or null. */
function findLatestBackup(asarPath) {
	try {
		const dir = resolve(asarPath, "..");
		const prefixes = ["app.asar.bak-hostpatch-", "app.asar.bak-linkfix-"];
		const matches = [];
		for (const entry of readdirSync(dir)) {
			if (prefixes.some((p) => entry.startsWith(p))) {
				const full = join(dir, entry);
				if (existsSync(full)) matches.push(full);
			}
		}
		if (matches.length === 0) return null;
		matches.sort(); // fixed-width timestamps sort lexicographically fine
		return matches[matches.length - 1];
	} catch {
		return null;
	}
}

/**
 * Apply all host patches to app.asar if any is missing. Idempotent.
 * Never throws; all failures are reported in the result.
 * @returns {{status:"patched"|"already"|"skipped"|"error", path?:string, error?:unknown, backup?:string}}
 */
export function selfHeal({ target: override, logger } = {}) {
	const log = logger?.info ? (m) => logger.info(m) : (m) => console.log(m);
	try {
		const asarPath = locateAsar(override);
		if (!asarPath) {
			const message = "dsh-desktop-context-menu host-patch: app.asar not found; skipping";
			log(message);
			return { status: "skipped", error: new Error(message) };
		}
		const srcBuf = readFileSync(asarPath);

		// Determine which patches are missing.
		const missing = [];
		const toApply = {};
		for (const p of PATCHES) {
			const current = readAsarFile(srcBuf, p.asarPath);
			if (current === "") {
				const message = `dsh-desktop-context-menu host-patch: ${p.asarPath} not found; skipping`;
				log(message);
				return { status: "skipped", error: new Error(message) };
			}
			if (current.includes(PATCH_MARKER)) continue; // already patched
			missing.push(p.id);
			toApply[p.asarPath] = readFileSync(p.patchFile, "utf8");
		}
		if (missing.length === 0) {
			log("dsh-desktop-context-menu host-patch: already patched; nothing to do");
			return { status: "already", path: asarPath };
		}

		const patched = rebuildAsar(srcBuf, toApply);
		const backup = replaceAsar(asarPath, patched);

		// Verify every patched file carries the marker.
		const written = readFileSync(asarPath);
		for (const p of PATCHES) {
			const v = readAsarFile(written, p.asarPath);
			if (v === "" || !v.includes(PATCH_MARKER)) {
				const message = `dsh-desktop-context-menu host-patch: write verification failed for ${p.asarPath}`;
				log(message);
				return { status: "error", path: asarPath, backup, error: new Error(message) };
			}
		}
		log(`dsh-desktop-context-menu host-patch: patched ${missing.join(", ")} in ${asarPath} (backup: ${backup}) — restart DSH to take effect`);
		return { status: "patched", path: asarPath, backup };
	} catch (error) {
		log(`dsh-desktop-context-menu host-patch: failed: ${error?.message ?? error}`);
		return { status: "error", error };
	}
}

/**
 * Remove all host patches from app.asar if present. Idempotent; never throws.
 * Restores from the most recent backup when available (byte-exact original),
 * otherwise rebuilds from the bundled original sources.
 * @returns {{status:"restored"|"already-clean"|"skipped"|"error", path?:string, error?:unknown, backup?:string, from?:string}}
 */
export function unpatch({ target: override, logger } = {}) {
	const log = logger?.info ? (m) => logger.info(m) : (m) => console.log(m);
	try {
		const asarPath = locateAsar(override);
		if (!asarPath) {
			const message = "dsh-desktop-context-menu host-patch: app.asar not found; skipping";
			log(message);
			return { status: "skipped", error: new Error(message) };
		}
		const srcBuf = readFileSync(asarPath);

		const anyPatched = PATCHES.some((p) => readAsarFile(srcBuf, p.asarPath).includes(PATCH_MARKER));
		if (!anyPatched) {
			log("dsh-desktop-context-menu host-patch: not patched; nothing to undo");
			return { status: "already-clean", path: asarPath };
		}

		// Prefer the byte-exact original from the latest backup.
		const latestBackup = findLatestBackup(asarPath);
		if (latestBackup) {
			const restored = readFileSync(latestBackup);
			// The backup must be a pre-patch app.asar (no marker in any target).
			const clean = !PATCHES.some((p) => readAsarFile(restored, p.asarPath).includes(PATCH_MARKER));
			if (clean) {
				const backup = replaceAsar(asarPath, restored);
				const verified = readFileSync(asarPath);
				const stillPatched = PATCHES.some((p) => readAsarFile(verified, p.asarPath).includes(PATCH_MARKER));
				if (!stillPatched) {
					log(`dsh-desktop-context-menu host-patch: restored original from backup ${latestBackup}`);
					return { status: "restored", path: asarPath, from: "backup", backup };
				}
			}
		}

		// Fallback: rebuild from the bundled original sources.
		const restoreMap = {};
		for (const p of PATCHES) restoreMap[p.asarPath] = readFileSync(p.origFile, "utf8");
		const restored = rebuildAsar(srcBuf, restoreMap);
		const backup = replaceAsar(asarPath, restored);
		const verified = readFileSync(asarPath);
		const stillPatched = PATCHES.some((p) => readAsarFile(verified, p.asarPath).includes(PATCH_MARKER));
		if (stillPatched) {
			const message = `dsh-desktop-context-menu host-patch: undo verification failed for ${asarPath}`;
			log(message);
			return { status: "error", path: asarPath, backup, error: new Error(message) };
		}
		log(`dsh-desktop-context-menu host-patch: restored original sources (backup of patched: ${backup})`);
		return { status: "restored", path: asarPath, from: "source", backup };
	} catch (error) {
		log(`dsh-desktop-context-menu host-patch: undo failed: ${error?.message ?? error}`);
		return { status: "error", error };
	}
}

// CLI entry: `node lib/host-patch.mjs [--undo] [app.asar-path]` — also used by
// install.ps1 (patch) and uninstall.ps1 (--undo).
// The invoked path may be a symlink into the profile (link install), so the
// plain resolve() comparison against import.meta.url would miss it and the
// CLI would silently no-op. Compare via realpath (follows the symlink) and
// fall back to a basename match.
function isThisFile(argv1) {
	if (typeof argv1 !== "string" || argv1.length === 0) return false;
	try {
		const real = realpathSync(argv1);
		const self = realpathSync(fileURLToPath(import.meta.url));
		if (real === self) return true;
	} catch { /* fall through to basename check */ }
	try {
		return basename(argv1) === basename(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
}
const isCli = isThisFile(process.argv[1]);
if (isCli) {
	const args = process.argv.slice(2);
	const undo = args.includes("--undo");
	const target = args.find((a) => !a.startsWith("--"));
	const result = undo ? unpatch({ target }) : selfHeal({ target });
	if (result.status === "patched" || result.status === "already" || result.status === "restored" || result.status === "already-clean") {
		console.log(`[ok] status=${result.status} path=${result.path ?? "?"}`);
		process.exit(0);
	}
	console.error(`[fail] status=${result.status} ${result.error?.message ?? ""}`);
	process.exit(1);
}
