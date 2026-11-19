// Plots of the Color Discrimination tab, ported from cols4all:
// palette_prob_bg() (Szafir 2018 mark discrimination model), plot_cvd()
// (simulation strip), plot_rgb() (hue lines / confusion lines), and the line
// and point example charts.

import { hexToLAB, hexToXYZ } from "../color.js";
import { simCVD } from "../colorops.js";

const LWD = 0.75, LINE = 14.4;
const f1 = x => +x.toFixed(2);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------- Szafir (2018): cols4all:::palette_prob_bg ----------

const MARK_COEFS = {
	line: { L: [0.0742, -0.0023], A: [0.0623, -0.0015], B: [0.0425, -0.0009] },
	point: { L: [0.0937, -0.0085], A: [0.0775, -0.0121], B: [0.0611, -0.0096] }
};
export const POINT_SIZE_MIN = 0.25;

const slope = (s, axis, mark) => MARK_COEFS[mark][axis][0] + MARK_COEFS[mark][axis][1] / s;

// n x n matrix of discrimination probabilities (%), null on the diagonal
export function probMatrix(pal, { cvd = "none", thickness = 0.05, mark = "line" } = {}) {
	if (mark === "point" && thickness < POINT_SIZE_MIN) thickness = POINT_SIZE_MIN;
	const cols = cvd === "none" ? pal : simCVD(pal, cvd);
	const lab = cols.map(hexToLAB);
	const mL = slope(thickness, "L", mark), mA = slope(thickness, "A", mark), mB = slope(thickness, "B", mark);
	return lab.map((a, i) => lab.map((b, j) => {
		if (i === j) return null;
		const p = Math.sqrt(((a[0] - b[0]) * mL) ** 2 + ((a[1] - b[1]) * mA) ** 2 + ((a[2] - b[2]) * mB) ** 2);
		return Math.min(p, 1) * 100;
	}));
}

// ---------- visual angle -> px ----------

// cols4all::visual_angle_to_px (szafir convention: 30 inch, 96 dpi, factor 1)
export const visualAngleToPx = deg => 30 * Math.tan(deg * Math.PI / 360) * 96;

// c4a_gui's cbf_px_per_deg(): calibrated with a viewing distance and the
// measured length of a 150px reference line (same unit), else the default
export function pxPerDeg(deg, viewDist, refLen) {
	if (!(viewDist > 0) || !(refLen > 0)) return visualAngleToPx(deg);
	return 2 * viewDist * Math.tan(deg * Math.PI / 360) * (150 / refLen);
}

// ---------- plot_cvd(): color blindness simulation strip ----------

export function cvdStripSVG(pal, { includeNA = false, dark = false, w = 800, h = 150 } = {}) {
	const n = pal.length;
	const fc = dark ? "#FFFFFF" : "#000000", bc = dark ? "#000000" : "#FFFFFF";
	const rows = [pal, ...["deutan", "protan", "tritan"].map(c => simCVD(pal, c))];
	const labels = ["Normal", "Deutan", "Protan", "Tritan"];
	const x0 = 3 * LINE, cw = (w - x0) / n, rh = (h - LINE) / 4;
	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${bc}"/>`;
	for (let i = 0; i < n; i++) {
		const txt = includeNA && i === n - 1 ? "Missing" : String(i + 1);
		s += `<text x="${f1(x0 + (i + 0.5) * cw)}" y="${f1(LINE / 2)}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${txt}</text>`;
		rows.forEach((r, j) => {
			s += `<rect x="${f1(x0 + i * cw)}" y="${f1(LINE + j * rh + 0.1 * rh)}" width="${f1(cw)}" height="${f1(0.8 * rh)}" fill="${r[i]}" stroke="${bc}" stroke-width="${2 * LWD}"/>`;
		});
	}
	labels.forEach((l, j) => {
		s += `<text x="${f1(0.95 * x0)}" y="${f1(LINE + (j + 0.5) * rh)}" fill="${fc}" font-size="12" text-anchor="end" dominant-baseline="central">${l}</text>`;
	});
	return s + "</svg>";
}

// ---------- plot_rgb(): hue lines (cvd "none") and confusion lines ----------

function hexToXy(hex) {
	const [X, Y, Z] = hexToXYZ(hex);
	const t = X + Y + Z;
	return [X / t, Y / t];
}

export function confusionSVG(pal, chroma, { cvd = "none", dark = false, size = 375 } = {}) {
	const bc = dark ? "#000000" : "#FFFFFF", tc = "#000000";
	const rx = v => (v - chroma.xrange[0]) / (chroma.xrange[1] - chroma.xrange[0]);
	const ry = v => (v - chroma.yrange[0]) / (chroma.yrange[1] - chroma.yrange[0]);
	const X = v => v * size, Y = v => (1 - v) * size;
	const w = hexToXy("#FFFFFF");
	const x0 = rx(w[0]), y0 = ry(w[1]);
	const id = "cl" + Math.random().toString(36).slice(2, 8);

	let s = `<svg class="plot" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
		+ `<defs><clipPath id="${id}"><rect width="${size}" height="${size}"/></clipPath></defs><g clip-path="url(#${id})">`
		+ `<rect width="${size}" height="${size}" fill="${bc}"/>`
		+ `<image href="img/chromaticity/${cvd}.png" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`;

	// confusion points (Dichromatic confusion lines), or the white point for hue lines
	const ind = ["none", "deutan", "protan", "tritan"].indexOf(cvd);
	const co = [[w[0], w[1]], [1.4, -0.4], [0.747, 0.253], [0.171, 0]][ind];
	const nAng = [30, 200, 100, 100][ind];
	const cx = rx(co[0]), cy = ry(co[1]);
	for (let k = 0; k < nAng - 1; k++) {
		const a = k * 2 * Math.PI / (nAng - 1);
		const r0 = cvd === "none" ? 0.025 : 0;
		s += `<line x1="${f1(X(cx + r0 * Math.cos(a)))}" y1="${f1(Y(cy + r0 * Math.sin(a)))}" x2="${f1(X(cx + 5 * Math.cos(a)))}" y2="${f1(Y(cy + 5 * Math.sin(a)))}" stroke="${cvd === "none" ? "#555555" : "#000000"}" stroke-width="${LWD}"/>`;
	}

	// palette colors (original, not simulated)
	pal.forEach((c, i) => {
		const [xx, yy] = hexToXy(c);
		const px = X(rx(xx)), py = Y(ry(yy));
		s += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(0.375 * 0.5 * LINE)}" fill="none" stroke="${tc}" stroke-width="${LWD}"/>`;
		s += `<text x="${f1(px - 0.6 * LINE)}" y="${f1(py - 0.6 * LINE)}" fill="${tc}" font-size="12" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
	});
	// white point
	const arm = Math.SQRT2 * 0.375 * 0.5 * LINE, wx = X(x0), wy = Y(y0);
	s += `<path d="M${f1(wx - arm)},${f1(wy)}H${f1(wx + arm)}M${f1(wx)},${f1(wy - arm)}V${f1(wy + arm)}" stroke="${tc}" stroke-width="${LWD}"/>`;
	return s + "</g></svg>";
}

// ---------- example charts (two selected colors, at the chosen mark size) ----------

// lines: c4a_plot_lines(cols, lwd, asp = 0.9): vertical lines; widthPx is the line width in CSS px
export function exLinesSVG(ex, cols, widthPx, { dark = false, w = 150, h = 375 } = {}) {
	const x = ex.lines.x;
	const s2 = ex.lines.s.slice(0, 2);
	const asp = 0.9;
	const compress = v => (v - 0.5) * asp + 0.5;
	const ext = (lo, hi) => [lo - (hi - lo) * 0.04, hi + (hi - lo) * 0.04];
	const [x0, x1] = ext(Math.min(...x), Math.max(...x));
	const [y0, y1] = ext(0, 1);
	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${dark ? "#000000" : "#FFFFFF"}"/>`;
	s2.forEach((si, j) => {
		const pts = si.map((v, i) => `${f1((compress(v) - y0) / (y1 - y0) * w)},${f1(h - (x[i] - x0) / (x1 - x0) * h)}`).join(" ");
		s += `<polyline points="${pts}" fill="none" stroke="${cols[j]}" stroke-width="${f1(widthPx)}" stroke-linejoin="round" stroke-linecap="round"/>`;
	});
	return s + "</svg>";
}

// points: c4a_plot_scatter(cols, lwd = 0); diamPx is the point diameter in CSS px
export function exPointsSVG(ex, cols, diamPx, { dark = false, w = 150, h = 375 } = {}) {
	const { x, y } = ex.scatter;
	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${dark ? "#000000" : "#FFFFFF"}"/>`;
	for (let i = 0; i < x.length; i++) {
		s += `<circle cx="${f1((x[i] + 1.5) / 3 * w)}" cy="${f1(h - (y[i] + 1.5) / 3 * h)}" r="${f1(diamPx / 2)}" fill="${cols[i % cols.length]}"/>`;
	}
	return s + "</svg>";
}

export const pctFormat = v => `${v.toFixed(0)}%`;
export { esc };
