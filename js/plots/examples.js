// Example charts of the Application tab, ported from cols4all's
// c4a_plot_scatter(), c4a_plot_lines(), c4a_plot_map() and c4a_plot_text().
//
// The R plots are rendered by shiny at 72 dpi, so 1 pt = 1 px and lwd = 1
// (1/96 inch) = 0.75 px. Those conversions are used here too.

import { roundR } from "../colorops.js";

const LWD = 0.75; // px per lwd unit
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const bgColor = dark => (dark ? "#000000" : "#FFFFFF");

function svgOpen(w, h, dark, extra = "") {
	return `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" ${extra}>`
		+ `<rect width="${w}" height="${h}" fill="${bgColor(dark)}"/>`;
}

// R's seq(from, to, length.out = n)
function seqLen(from, to, n) {
	const by = (to - from) / (n - 1);
	const x = Array.from({ length: n }, (_, i) => from + i * by);
	x[n - 1] = to;
	return x;
}

// cols[round(seq(1 - 0.5/n, n + 0.5/n, length.out = k))]: k values, evenly spread over the n colors
const spread = (cols, n, k) => seqLen(1 - 0.5 / n, n + 0.5 / n, k).map(x => cols[roundR(x) - 1]);

// c4a_plot_scatter()
export function scatterSVG(ex, cols, { dist = "random", size = 1, borders = "black", lwd = 0, dark = false, w = 800, h = 400 } = {}) {
	const { x, y } = ex.scatter;
	const k = x.length, n = cols.length;
	let fill;
	if (dist === "concentric") {
		const d2 = x.map((xi, i) => xi * xi + y[i] * y[i]);
		const ord = d2.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(a => a[1]);
		const rank = Array(k);
		ord.forEach((i, r) => (rank[i] = r));
		const f = spread(cols, n, k);
		fill = rank.map(r => f[r]);
	} else {
		fill = Array.from({ length: k }, (_, i) => cols[i % n]);
	}
	const r = 0.375 * 12 * size;
	const stroke = lwd > 0 ? ` stroke="${borders}" stroke-width="${lwd * LWD}"` : "";
	const px = v => ((v + 1.5) / 3) * w, py = v => h - ((v + 1.5) / 3) * h;
	let s = svgOpen(w, h, dark);
	for (let i = 0; i < k; i++) s += `<circle cx="${px(x[i]).toFixed(1)}" cy="${py(y[i]).toFixed(1)}" r="${r}" fill="${fill[i]}"${stroke}/>`;
	return s + "</svg>";
}

// c4a_plot_lines()
export function linesSVG(ex, cols, { lwd = 1, stacked = false, dark = false, w = 800, h = 400, asp = 1 } = {}) {
	const x = ex.lines.x;
	const k = Math.min(cols.length, 36);
	const cl = Array.from({ length: k }, (_, i) => cols[i % cols.length]);
	let s = ex.lines.s.slice(0, k);
	if (stacked) s = s.map((si, j) => si.map(v => (k - j - 1) / k + v / k));
	const compress = (v, a) => (v - 0.5) * a + 0.5;
	// base graphics: axis ranges extended by 4%
	const ext = (lo, hi) => [lo - (hi - lo) * 0.04, hi + (hi - lo) * 0.04];
	const [x0, x1] = ext(Math.min(...x), Math.max(...x));
	const [y0, y1] = ext(0, 1);
	let pts;
	if (asp >= 1) {
		pts = si => si.map((v, i) => [(x[i] - x0) / (x1 - x0) * w, h - (compress(v, 1 / asp) - y0) / (y1 - y0) * h]);
	} else {
		// vertical lines (used for the narrow example charts)
		pts = si => si.map((v, i) => [(compress(v, asp) - y0) / (y1 - y0) * w, h - (x[i] - x0) / (x1 - x0) * h]);
	}
	let out = svgOpen(w, h, dark);
	s.forEach((si, j) => {
		const d = pts(si).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
		out += `<polyline points="${d}" fill="none" stroke="${cl[j]}" stroke-width="${lwd * LWD}" stroke-linejoin="round" stroke-linecap="round"/>`;
	});
	return out + "</svg>";
}

// c4a_plot_map()
export function mapSVG(ex, cols, { dist = "random", borders = "black", lwd = 0, includeNA = false, dark = false, w = 800, h = 400, crop = false } = {}) {
	const { paths, width, height } = ex.map;
	const k = paths.length;
	const n = cols.length - (includeNA ? 1 : 0);
	let fill;
	if (dist === "random") {
		fill = Array.from({ length: k }, (_, i) => cols[i % cols.length]);
	} else {
		fill = spread(cols, n, k);
		if (includeNA) {
			// random sample of 10% of the polygons (as sample.int in R)
			const idx = [...Array(k).keys()];
			for (let i = idx.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[idx[i], idx[j]] = [idx[j], idx[i]];
			}
			idx.slice(0, roundR(k / 10)).forEach(i => (fill[i] = cols[n]));
		}
	}
	let vx = 0, vw = width;
	if (crop) { vx = width * 0.6; vw = width * 0.2; }
	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${bgColor(dark)}"/>`
		+ `<svg viewBox="${vx} 0 ${vw} ${height}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">`;
	paths.forEach((d, i) => {
		const stroke = lwd > 0 ? `stroke="${borders}" stroke-width="${lwd * LWD}"` : `stroke="${fill[i]}" stroke-width="${LWD}"`;
		s += `<path d="${d}" fill="${fill[i]}" ${stroke} vector-effect="non-scaling-stroke" fill-rule="evenodd"/>`;
	});
	return s + "</svg></svg>";
}

// c4a_plot_text()
export function textSVG(cols, { words = null, size = 12, face = "plain", frame = false, dark = false, w = 800, h = 120 } = {}) {
	const k = cols.length;
	const bg = bgColor(dark);
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const wds = Array.from({ length: k }, (_, i) => (words ? words[i % words.length] : letters[i % 26] + letters[i % 26].toLowerCase()));
	const dasp = w / h;
	// number of rows (1-5) such that the layout aspect ratio is closest to the device
	let best = Infinity, m = 1;
	for (let cnr = 1; cnr <= 5; cnr++) {
		const casp = Math.ceil(k / cnr) / cnr;
		const b = casp < dasp ? dasp / casp : casp / dasp;
		if (b < best) { best = b; m = cnr; }
	}
	const n = Math.ceil(k / m);
	const cell = dasp > n / m ? h / m : w / n;
	const weight = face === "bold" ? "bold" : "normal";
	const style = face === "italic" ? "italic" : "normal";
	let s = svgOpen(w, h, dark);
	let z = 0;
	for (let j = 0; j < m; j++) {
		for (let i = 0; i < n; i++, z++) {
			if (z >= k) break;
			const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell;
			if (frame) {
				const r = cell * 0.95;
				s += `<rect x="${cx - r / 2}" y="${cy - r / 2}" width="${r}" height="${r}" fill="${cols[z]}"/>`;
			}
			s += `<text x="${cx}" y="${cy}" fill="${frame ? bg : cols[z]}" font-size="${size}" font-weight="${weight}" font-style="${style}" text-anchor="middle" dominant-baseline="central">${esc(wds[z])}</text>`;
		}
	}
	return s + "</svg>";
}
