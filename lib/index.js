// dsh-desktop-context-menu — host side. The interactive behavior lives
// entirely in the browser half (lib/client.js): a document-level contextmenu
// listener plus a small floating toolbar. The host entry additionally
// self-heals the desktop host patches (see lib/host-patch.mjs): the
// "open external links in the system browser" navigation policy AND the
// "allow clipboard-read on loopback" renderer permission — so DSH updates
// can never silently break chat hyperlinks or renderer clipboard reads.
// Same self-heal pattern as dsh-deepseek-reasoning-patch.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { selfHeal } from "./host-patch.mjs";

// Name guard (v0.1.3): DSH v3.5.0's client-modules keys the browser-half
// lookup on the loader entry name and drops any package whose manifest
// `name` differs — e.g. a scoped rename (`@funnySnake11111/...`) made to
// publish on GitHub Packages. The host half still loads (patches apply),
// but the context menu silently never appears. Warn loudly so a rename
// cannot break the plugin invisibly. Keep this in sync with the `name:` of
// the insert entry in cordis.patch.yml.
const EXPECTED_PACKAGE_NAME = "dsh-desktop-context-menu";
try {
	const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.name !== EXPECTED_PACKAGE_NAME) {
		console.warn(
			`[dsh-desktop-context-menu] package.json "name" is "${manifest.name}" but must be ` +
			`"${EXPECTED_PACKAGE_NAME}" — a scoped name makes DSH v3.5.0 client-modules skip this ` +
			`package (context menu missing) while the host half keeps running. If you renamed it ` +
			`for GitHub Packages publishing, change it back (see README §安装).`,
		);
	}
} catch {
	// Manifest unreadable — not our problem to fail the tree over.
}

// Heal immediately on import (before/while the tree activates) — best
// effort, never throws.
try {
	selfHeal();
} catch {}

export function apply(ctx) {
	// Run again with the real logger once the tree is up, so a repair made
	// at import time is also visible in host logs and any race is covered.
	try {
		selfHeal({ logger: ctx?.logger });
	} catch {}
}
