// Parity test: the JavaScript scores (js/score.js) of all built-in palettes
// must equal the scores computed by cols4all in R (data/<type>.json).
//
// Run from the repository root:  node tests/score.test.mjs

import { readFileSync } from "node:fs";
import { scoreRow, C4A, prepareCustom, customRow } from "../js/score.js";

const load = f => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url)));
const ctx = { nd: load("naming"), fp: load("hcl").fairness };

const close = (a, b) => a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 1e-9);
// a difference of one unit in the last (rounded) digit: floating point noise
// that ends up on the other side of a rounding boundary (e.g. 807.4999 vs 807.5)
const roundingNoise = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= 0.0100001;
// exported numbers: non-finite as null
const fin = x => (typeof x === "number" && !Number.isFinite(x) ? null : x);

let total = 0, failed = 0, noise = 0;
const fails = {};
for (const type of ["cat", "seq", "div", "cyc", "bivs", "bivc", "bivd", "bivg"]) {
	const data = load(type);
	const biv = type.startsWith("biv");
	for (const [key, rows] of Object.entries(data.rows)) {
		const [n, m] = key.split("x").map(Number);
		if (n < C4A.nmin[type]) continue; // no scores in R
		// bivariate palettes are scored with a fixed number of rows (the other rows show the same scores)
		if (biv && m !== (type === "bivs" ? n : C4A.mScore[type])) continue;
		for (const r of rows) {
			total++;
			// bivariate: row-major colors -> array of rows
			const p = biv ? Array.from({ length: m }, (_, i) => r.c.slice(i * n, (i + 1) * n)) : r.c;
			const js = scoreRow(p, type, n, ctx);
			let bad = Object.keys(js).filter(k => !close(fin(js[k]), r[k] ?? null));
			const nz = bad.filter(k => roundingNoise(fin(js[k]), r[k]));
			if (nz.length) {
				noise++;
				console.log(`rounding difference ${r.f} n=${n}: ${nz.map(k => `${k} R ${r[k]} JS ${fin(js[k])}`).join(", ")}`);
				// derived values (e.g. cbfriendly) follow the rounded value
				bad = bad.filter(k => !nz.includes(k) && !(k.startsWith("cbfriendly") && Math.abs(js[k] - r[k]) < 1e-4));
			}
			if (bad.length) {
				failed++;
				for (const k of bad) {
					(fails[`${type}.${k}`] ??= []).push(`${r.f} n=${n}: R ${JSON.stringify(r[k])} JS ${JSON.stringify(fin(js[k]))}`);
				}
			}
		}
	}
}

// Custom palettes: c4a_data() + c4a_load() in R (tests/custom_ref.R) versus
// prepareCustom() + customRow() here, including the colors per n (default
// range) and the color for missing values
const ref = JSON.parse(readFileSync(new URL("custom_ref.json", import.meta.url)));
for (const [name, x] of Object.entries(ref)) {
	const pal = prepareCustom({ name, type: x.type, colors: x.colors, ncol: x.ncol });
	if (pal.na !== x.na) {
		failed++;
		(fails[`custom.na`] ??= []).push(`${name}: R ${x.na} JS ${pal.na}`);
	}
	for (const r of x.rows) {
		total++;
		const js = customRow(pal, x.type.startsWith("biv") ? `${r.n}x${r.m}` : r.n, ctx);
		const bad = ["c", ...Object.keys(r).filter(k => !["n", "m", "c"].includes(k))]
			.filter(k => (k === "c" ? js.c.join() !== r.c.join() : !close(fin(js[k]), r[k] ?? null)));
		if (bad.length) {
			failed++;
			for (const k of bad) (fails[`custom.${k}`] ??= []).push(`${name} n=${r.n}${r.m ? "x" + r.m : ""}: R ${JSON.stringify(r[k])} JS ${JSON.stringify(k === "c" ? js.c : fin(js[k]))}`);
		}
	}
}

for (const [k, v] of Object.entries(fails)) {
	console.log(`${k}: ${v.length} differences, e.g.\n  ${v.slice(0, 3).join("\n  ")}`);
}
console.log(`${total - failed - noise} of ${total} rows identical, ${noise} with a rounding difference, ${failed} different`);
process.exit(failed ? 1 : 0);
