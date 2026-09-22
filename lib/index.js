// dsh-desktop-context-menu — host side. The interactive behavior lives
// entirely in the browser half (lib/client.js): a document-level contextmenu
// listener plus a small floating toolbar. The host entry exists only so the
// bundle activates in the cordis tree and @deepseek-ai/dsh-client-modules
// serves ./client.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Name guard (v0.1.3): DSH v3.5.0's client-modules keys the browser-half
// lookup on the loader entry name and drops any package whose manifest
// `name` differs — e.g. a scoped rename (`@funnySnake11111/...`) made to
// publish on GitHub Packages. The host half still loads, but the context
// menu silently never appears. Warn loudly so a rename cannot break the
// plugin invisibly. Keep this in sync with the `name:` of the insert entry
// in cordis.patch.yml.
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

export function apply() {
	// no-op: nothing to run on the host
}
