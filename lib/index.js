// dsh-desktop-context-menu — host side. The interactive behavior lives
// entirely in the browser half (lib/client.js): a document-level contextmenu
// listener plus a small floating toolbar. The host entry additionally
// self-heals the desktop host patches (see lib/host-patch.mjs): the
// "open external links in the system browser" navigation policy AND the
// "allow clipboard-read on loopback" renderer permission — so DSH updates
// can never silently break chat hyperlinks or renderer clipboard reads.
// Same self-heal pattern as dsh-deepseek-reasoning-patch.
import { selfHeal } from "./host-patch.mjs";

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
