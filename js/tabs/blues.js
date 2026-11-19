// 3D Blues tab (c4a_gui's "3D Blues" tab)

import { approxBlues, approxReds, floatingRings } from "../plots/blues.js";
import { textSVG } from "../plots/examples.js";

const $ = sel => document.querySelector(sel);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const bluesDefaults = { original: false, rev: false };

// R's which.max: first maximum
const whichMax = v => v.reduce((best, x, i) => (x > v[best] ? i : best), 0);

// ctx: { state, getSelection(), isDark(), meta, changed() }
export function setupBlues(ctx) {
	const s = ctx.state;
	// selected colors (indices; idC1: the blue one, idC2: the red one), reset when the colors change
	let pick = { key: null, i1: 0, i2: 0 };

	$("#blues-orig").addEventListener("change", e => { s.original = e.target.checked; render(); ctx.changed(); });
	$("#blues-rev").addEventListener("change", e => { s.rev = e.target.checked; render(); ctx.changed(); });
	$("#blues-col1").addEventListener("change", e => { pick.i1 = +e.target.value; render(); });
	$("#blues-col2").addEventListener("change", e => { pick.i2 = +e.target.value; render(); });

	function sync() {
		$("#blues-orig").checked = s.original;
		$("#blues-rev").checked = s.rev;
	}

	async function render() {
		const sel = ctx.getSelection();
		const dark = ctx.isDark();
		if (!sel || !sel.cols.length) {
			["#blues-letters", "#blues-letters-ab", "#blues-text"].forEach(o => ($(o).innerHTML = ""));
			return;
		}
		const pal = sel.cols;
		const b = approxBlues(pal), r = approxReds(pal);
		const key = pal.join();
		if (pick.key !== key) {
			pick = { key, i1: whichMax(b), i2: whichMax(r) };
			const opts = pal.map((_, i) => `<option value="${i}">${LETTERS[i] ?? i + 1}</option>`).join("");
			$("#blues-col1").innerHTML = opts;
			$("#blues-col2").innerHTML = opts;
		}
		$("#blues-col1").value = pick.i1;
		$("#blues-col2").value = pick.i2;

		// c4a_plot_text(size = 1.25) in R: shown here at 1.25 x 12pt, so that the letters are readable
		const size = 15;
		$("#blues-letters").innerHTML = textSVG(pal, { size, frame: true, dark, w: 300, h: 80 });

		const mb = Math.max(...b), mr = Math.max(...r);
		const L1 = LETTERS[whichMax(b)], L2 = LETTERS[whichMax(r)];
		const BLUES = ctx.meta.thresholds.Blues;
		$("#blues-text").textContent =
			mb > BLUES && mr > 100 ? `This illusion will likely occur with blue color ${L1} and a red color (e.g. ${L2}), at least with a dark background`
			: mb > 100 && mr > 100 ? `This illusion could occur with blue color ${L1} and a red color (e.g. ${L2}), at least with a dark background`
			: mb > 100 && mr <= 100 ? "This illusion will probably not occur, because the palette does not contain a red(dish) color"
			: "This illusion will probably not occur, because the palette does not contain any blue color";

		const c1 = pal[pick.i1], c2 = pal[pick.i2];
		$("#blues-letters-ab").innerHTML = textSVG([c1, c2], { words: [LETTERS[pick.i1], LETTERS[pick.i2]], size, frame: true, dark, w: 300, h: 150 });

		let cols;
		if (s.original) {
			cols = ["#FF0000", "#0000FF"];
			if (s.rev) cols.reverse();
			await floatingRings($("#blues-rings"), cols[0], cols[1], true);
		} else {
			cols = [c1, c2];
			if (s.rev) cols.reverse();
			await floatingRings($("#blues-rings"), cols[1], cols[0], dark);
		}
	}

	sync();
	return { render, sync };
}
