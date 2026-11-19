// Application tab: the selected palette in example charts (c4a_gui's "Application" tab)

import { simCVD } from "../colorops.js";
import { scatterSVG, linesSVG, mapSVG, textSVG } from "../plots/examples.js";

const $ = sel => document.querySelector(sel);

// Settings of this tab, with their defaults (as in c4a_gui)
export const appDefaults = {
	cvd: "none",
	dotDist: "random", dotSize: 1, dotBorders: "black", dotLwd: 0,
	lineStack: false, lineLwd: 3,
	mapDist: "random", mapBorders: "black", mapLwd: 1,
	txtSize: 12, txtFace: "plain"
};

// ctx: { state (app settings object, mutated), getSelection(), isDark(), loadJSON(), changed() }
export function setupApplication(ctx) {
	const s = ctx.state;

	const bindings = [
		["#app-cvd", "cvd", "select"],
		["app-dot-dist", "dotDist", "radio"], ["#app-dot-size", "dotSize", "range"], ["#app-dot-borders", "dotBorders", "select"], ["#app-dot-lwd", "dotLwd", "range"],
		["#app-line-stack", "lineStack", "check"], ["#app-line-lwd", "lineLwd", "range"],
		["app-map-dist", "mapDist", "radio"], ["#app-map-borders", "mapBorders", "select"], ["#app-map-lwd", "mapLwd", "range"],
		["#app-txt-size", "txtSize", "range"], ["app-txt-face", "txtFace", "radio"]
	];

	// state -> controls
	function sync() {
		for (const [sel, key, kind] of bindings) {
			if (kind === "radio") {
				document.querySelectorAll(`input[name="${sel}"]`).forEach(x => (x.checked = x.value === String(s[key])));
			} else if (kind === "check") {
				$(sel).checked = !!s[key];
			} else {
				$(sel).value = s[key];
				const out = $(sel + "-out");
				if (out) out.textContent = s[key];
			}
		}
	}

	// controls -> state
	for (const [sel, key, kind] of bindings) {
		if (kind === "radio") {
			document.querySelectorAll(`input[name="${sel}"]`).forEach(x => x.addEventListener("change", () => {
				s[key] = x.value; render(); ctx.changed();
			}));
		} else {
			const el = $(sel);
			el.addEventListener(kind === "range" ? "input" : "change", () => {
				s[key] = kind === "check" ? el.checked : kind === "range" ? +el.value : el.value;
				const out = $(sel + "-out");
				if (out) out.textContent = el.value;
				render();
				ctx.changed();
			});
		}
	}

	async function render() {
		const sel = ctx.getSelection();
		const boxes = ["#app-dots", "#app-lines", "#app-map", "#app-text1", "#app-text2"];
		if (!sel || !sel.cols.length) {
			boxes.forEach(b => ($(b).innerHTML = ""));
			$("#app-dots").innerHTML = `<p class="placeholder">No palette selected.</p>`;
			return;
		}
		const ex = await ctx.loadJSON("examples");
		const dark = ctx.isDark();
		const cols = simCVD(sel.cols, s.cvd);
		$("#app-dots").innerHTML = scatterSVG(ex, cols, { dist: s.dotDist, size: s.dotSize, borders: s.dotBorders, lwd: s.dotLwd, dark });
		$("#app-lines").innerHTML = linesSVG(ex, cols, { lwd: s.lineLwd, stacked: s.lineStack, dark });
		$("#app-map").innerHTML = mapSVG(ex, cols, { dist: s.mapDist, borders: s.mapBorders, lwd: s.mapLwd, includeNA: sel.na, dark });
		$("#app-text1").innerHTML = textSVG(cols, { size: s.txtSize, face: s.txtFace, dark });
		$("#app-text2").innerHTML = textSVG(cols, { size: s.txtSize, face: s.txtFace, dark, frame: true });
	}

	sync();
	return { render, sync };
}
