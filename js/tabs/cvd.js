// Color Discrimination tab (c4a_gui's "Color Discrimination" tab)

import { probMatrix, pxPerDeg, cvdStripSVG, confusionSVG, exLinesSVG, exPointsSVG, pctFormat } from "../plots/cvd.js";
import { matrixSVG } from "../plots/contrast.js";
import { simCVD } from "../colorops.js";

const $ = sel => document.querySelector(sel);

// sizes in degrees of visual angle; separate sliders per mark, as in c4a_gui
// (validated ranges of Szafir's models differ: lines 0.05-0.35, points 0.25-2.0)
const SIZES = {
	line: { min: 0.05, max: 0.2, step: 0.05 },
	point: { min: 0.25, max: 0.5, step: 0.05 }
};

export const cvdDefaults = { mark: "line", lineSize: 0.05, pointSize: 0.25, numbers: false, viewDist: 650, refLen: 27 };

const ROWS = [
	{ cvd: "none", label: "Normal color vision" },
	{ cvd: "deutan", label: "Deutan (red-green blind)" },
	{ cvd: "protan", label: "Protan (also red-green blind)" },
	{ cvd: "tritan", label: "Tritan (blue-yellow)" }
];

// ctx: { state, getSelection(), isDark(), loadJSON(), meta, changed() }
export function setupCVD(ctx) {
	const s = ctx.state;
	let pair = { key: null, id1: 0, id2: 1 };
	const hits = {};

	// static layout of the four rows
	$("#cvd-rows").innerHTML = ROWS.map((r, i) => `
		${i === 1 ? `<div class="cvd-grid cvd-head"><div><h4>Confusion lines <button type="button" class="ani-btn" data-ani="conf" aria-label="Explanation"></button></h4></div><div><h4>Separability (perceived) <button type="button" class="ani-btn" data-ani="psimi" aria-label="Explanation"></button></h4></div><div></div></div>` : ""}
		<div class="cvd-label">${r.label}</div>
		<div class="cvd-grid">
			<div class="plot-box" id="cvd-cl-${r.cvd}"></div>
			<div class="plot-box clickable" id="cvd-mat-${r.cvd}" data-cvd="${r.cvd}"></div>
			<div class="plot-box" id="cvd-ex-${r.cvd}"></div>
		</div>`).join("");

	const sizeKey = () => (s.mark === "point" ? "pointSize" : "lineSize");

	function syncSize() {
		const r = SIZES[s.mark], el = $("#cvd-size");
		el.min = r.min; el.max = r.max; el.step = r.step;
		el.value = s[sizeKey()];
		$("#cvd-size-out").textContent = `${(+s[sizeKey()]).toFixed(2)}°`;
	}

	function sync() {
		document.querySelectorAll('input[name="cvd-mark"]').forEach(x => (x.checked = x.value === s.mark));
		$("#cvd-numbers").checked = s.numbers;
		$("#cvd-viewdist").value = s.viewDist ?? "";
		$("#cvd-reflen").value = s.refLen ?? "";
		syncSize();
	}

	document.querySelectorAll('input[name="cvd-mark"]').forEach(x => x.addEventListener("change", () => {
		s.mark = x.value; syncSize(); render(); ctx.changed();
	}));
	$("#cvd-size").addEventListener("input", e => {
		s[sizeKey()] = +e.target.value; syncSize(); render(); ctx.changed();
	});
	$("#cvd-numbers").addEventListener("change", e => { s.numbers = e.target.checked; render(); ctx.changed(); });
	for (const [id, key] of [["#cvd-viewdist", "viewDist"], ["#cvd-reflen", "refLen"]]) {
		$(id).addEventListener("input", e => {
			const v = parseFloat(e.target.value);
			s[key] = isFinite(v) ? v : 0;
			renderExamples();
			ctx.changed();
		});
	}

	$("#cvd-rows").addEventListener("click", e => {
		const box = e.target.closest("[data-cvd]");
		const svg = e.target.closest("svg");
		if (!box || !svg || !hits[box.dataset.cvd]) return;
		const pt = svg.createSVGPoint();
		pt.x = e.clientX; pt.y = e.clientY;
		const p = pt.matrixTransform(svg.getScreenCTM().inverse());
		const { row, col } = hits[box.dataset.cvd](p.x, p.y);
		if (row !== null) pair.id1 = row;
		if (col !== null) pair.id2 = col;
		if (row !== null || col !== null) render(false);
	});

	let current = null; // { pal, mats }

	async function renderExamples() {
		const sel = ctx.getSelection();
		if (!current || !sel || !sel.cols.length) return;
		const ex = await ctx.loadJSON("examples");
		const dark = ctx.isDark();
		const px = pxPerDeg(s[sizeKey()], s.viewDist, s.refLen);
		const cols = [current.pal[pair.id1], current.pal[pair.id2]];
		for (const r of ROWS) {
			const c = simCVD(cols, r.cvd);
			$(`#cvd-ex-${r.cvd}`).innerHTML = s.mark === "point" ? exPointsSVG(ex, c, px, { dark }) : exLinesSVG(ex, c, px, { dark });
		}
	}

	// recompute: false when only the selected pair changed
	async function render(recompute = true) {
		const sel = ctx.getSelection();
		const dark = ctx.isDark();
		if (!sel || !sel.cols.length) {
			$("#cvd-strip").innerHTML = `<p class="placeholder">No palette selected.</p>`;
			ROWS.forEach(r => ["cl", "mat", "ex"].forEach(k => ($(`#cvd-${k}-${r.cvd}`).innerHTML = "")));
			current = null;
			return;
		}
		const pal = sel.cols;
		const key = pal.join();
		if (pair.key !== key) pair = { key, id1: 0, id2: 1 };

		if (recompute || !current) {
			const chroma = await ctx.loadJSON("chromaticity");
			$("#cvd-strip").innerHTML = cvdStripSVG(pal, { includeNA: sel.na, dark });
			for (const r of ROWS) $(`#cvd-cl-${r.cvd}`).innerHTML = confusionSVG(pal, chroma, { cvd: r.cvd, dark });
			const thickness = s[sizeKey()];
			current = { pal, mats: Object.fromEntries(ROWS.map(r => [r.cvd, probMatrix(pal, { cvd: r.cvd, thickness, mark: s.mark })])) };
		}
		const spec = { ...ctx.meta.matrix.dist, title: "% Discriminable" };
		for (const r of ROWS) {
			const mat = matrixSVG(current.mats[r.cvd], simCVD(pal, r.cvd), spec, {
				id1: pair.id1, id2: pair.id2, dark, showNumbers: s.numbers, numberFormat: pctFormat, w: 500, h: 375
			});
			hits[r.cvd] = mat.hit;
			$(`#cvd-mat-${r.cvd}`).innerHTML = mat.svg;
		}
		await renderExamples();
	}

	sync();
	return { render, sync };
}
