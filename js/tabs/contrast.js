// Contrast tab (c4a_gui's "Contrast" tab)

import { contrastRatio, crMatrix, matrixSVG, crBarSVG, text2SVG, barsSVG, plusReversed } from "../plots/contrast.js";
import { mapSVG } from "../plots/examples.js";

const $ = sel => document.querySelector(sel);

export const contrastDefaults = {
	sort: false, wcag: false, equi: false,
	chart: "Choropleth", borders: "black", lwd: 0,
	plusOriginal: false
};

const WCAG = '<a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener">WCAG 2.2</a>';

// R: sprintf("%.2f", round(cr, 1))
const fmtCR = cr => (Math.round(cr * 10) / 10).toFixed(2);

function textAdvice(cr) {
	const txt = cr >= 7 ? `safe to print text according to ${WCAG} level <b>AAA</b>`
		: cr >= 4.5 ? `safe to print text according to the ${WCAG} level <b>AA</b>`
		: cr >= 3 ? `safe to print text according to the ${WCAG} level <b>A</b>`
		: `not safe to print text according to the ${WCAG}`;
	return `<b>Contrast ratio</b> (${fmtCR(cr)}): ${txt}`;
}

function borderAdvice(cr) {
	const txt = cr <= 1.2 ? "strongly recommended to use border lines when plotting these colors next to each other"
		: cr <= 1.5 ? "recommended to use border lines when plotting these colors next to each other"
		: cr <= 2 ? "consider to use border lines when plotting these colors next to each other"
		: "colors can be plot next to each other without border lines";
	return `<b>Contrast ratio</b> (${fmtCR(cr)}): ${txt}`;
}

// ctx: { state, getSelection(), isDark(), loadJSON(), meta, changed() }
export function setupContrast(ctx) {
	const s = ctx.state;
	// selected pair of colors (idB1: row, idB2: column), reset when the colors change
	let pair = { key: null, id1: 0, id2: 1 };
	let hit = null;

	const checks = [["#cr-sort", "sort"], ["#cr-wcag", "wcag"], ["#cr-equi", "equi"], ["#cr-plus-orig", "plusOriginal"]];
	for (const [id, key] of checks) {
		$(id).addEventListener("change", e => { s[key] = e.target.checked; render(); ctx.changed(); });
	}
	document.querySelectorAll('input[name="cr-chart"]').forEach(x => x.addEventListener("change", () => { s.chart = x.value; render(); ctx.changed(); }));
	$("#cr-border-col").addEventListener("change", e => { s.borders = e.target.value; render(); ctx.changed(); });
	$("#cr-lwd").addEventListener("input", e => { s.lwd = +e.target.value; $("#cr-lwd-out").textContent = s.lwd; render(); ctx.changed(); });

	$("#cr-matrix").addEventListener("click", e => {
		const svg = e.target.closest("svg");
		if (!svg || !hit) return;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX; pt.y = e.clientY;
		const p = pt.matrixTransform(svg.getScreenCTM().inverse());
		const { row, col } = hit(p.x, p.y);
		if (row !== null) pair.id1 = row;
		if (col !== null) pair.id2 = col;
		if (row !== null || col !== null) render();
	});

	function sync() {
		for (const [id, key] of checks) $(id).checked = !!s[key];
		document.querySelectorAll('input[name="cr-chart"]').forEach(x => (x.checked = x.value === s.chart));
		$("#cr-border-col").value = s.borders;
		$("#cr-lwd").value = s.lwd;
		$("#cr-lwd-out").textContent = s.lwd;
	}

	async function render() {
		const sel = ctx.getSelection();
		const dark = ctx.isDark();
		$("#cr-title").textContent = `Contrast ratios with ${dark ? "black" : "white"} (background)`;
		const outs = ["#cr-plot", "#cr-matrix", "#cr-text-plot", "#cr-example", "#cr-text", "#cr-borders"];
		if (!sel || !sel.cols.length) {
			outs.forEach(o => ($(o).innerHTML = ""));
			$("#cr-plot").innerHTML = `<p class="placeholder">No palette selected.</p>`;
			return;
		}
		const pal = sel.cols;
		// palette with white and black added (tab_vals$palBW)
		const palBW = [...new Set([...pal, "#FFFFFF", "#000000"])];
		const key = pal.join();
		if (pair.key !== key) pair = { key, id1: 0, id2: 1 };
		const c1 = palBW[pair.id1], c2 = palBW[pair.id2];
		const cr = contrastRatio(c1, c2);

		$("#cr-plot").innerHTML = crBarSVG(pal, { dark, sort: s.sort, linesWCAG: s.wcag, linesEqui: s.equi });

		const spec = { ...ctx.meta.matrix.CR, title: "Contrast ratio" };
		const mat = matrixSVG(crMatrix(palBW), palBW, spec, { id1: pair.id1, id2: pair.id2, dark });
		hit = mat.hit;
		$("#cr-matrix").innerHTML = mat.svg;

		$("#cr-text").innerHTML = textAdvice(cr);
		$("#cr-text-plot").innerHTML = text2SVG(c1, c2, { dark });
		$("#cr-borders").innerHTML = borderAdvice(cr);

		if (s.chart === "Barchart") {
			const ex = await ctx.loadJSON("examples");
			$("#cr-example").innerHTML = barsSVG(ex, c1, c2, { borders: s.borders, lwd: s.lwd, dark });
		} else {
			const ex = await ctx.loadJSON("examples");
			$("#cr-example").innerHTML = mapSVG(ex, [c1, c2], { borders: s.borders, lwd: s.lwd, dark, w: 600, h: 300 });
		}

		await plusReversed($("#cr-plus"), s.plusOriginal
			? { borders: s.borders, lwd: s.lwd }
			: { col1: c1, col2: c2, borders: s.borders, lwd: s.lwd });
	}

	sync();
	return { render, sync };
}
