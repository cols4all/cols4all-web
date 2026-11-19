// Naming tab: cols4all's naming model (naming_sample_from_distribution(),
// matrix_softmax()) and c4a_plot_names().

import { hexToHCL } from "../color.js";

const LINE = 14.4;
const f1 = x => +x.toFixed(2);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// log-gamma (Lanczos approximation, g = 7)
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
	-176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
	if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
	x -= 1;
	let a = LG[0];
	const t = x + 7.5;
	for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
	return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// stats::dbeta
function dbeta(x, a, b) {
	if (x < 0 || x > 1) return 0;
	if (x === 0) return a < 1 ? Infinity : a === 1 ? b : 0;
	if (x === 1) return b < 1 ? Infinity : b === 1 ? a : 0;
	return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) + lgamma(a + b) - lgamma(a) - lgamma(b));
}

// cols4all:::naming_sample_from_distribution: matrix (colors x names) of minus the probabilities
export function namingMatrix(pal, nd) {
	return pal.map(hex => {
		const [H, C, L] = hexToHCL(hex);
		const v = { H, C, L };
		const z = nd.names.map(nm => {
			const md = nd.model[nm];
			let p = 1;
			for (const d of ["H", "C", "L"]) {
				const r = md[d];
				const sc = x => (x - r.mn) / (r.mx - r.mn);
				const vs = d === "H" ? [sc(v.H), sc(v.H - 360), sc(v.H + 360)] : [sc(v[d])];
				p *= vs.reduce((acc, x) => acc + dbeta(x, r.shape1, r.shape2), 0);
			}
			return p;
		});
		const tot = z.reduce((a, b) => a + b, 0);
		return z.map(x => -x / tot);
	});
}

// cols4all:::matrix_softmax
export function softmaxMatrix(m, a, th) {
	return m.map(row => {
		const ex = row.map(x => Math.exp(-a * x));
		const tot = ex.reduce((s, x) => s + x, 0);
		return ex.map(x => (x / tot < th ? 0 : x / tot));
	});
}

// c4a_plot_names()
export function namesSVG(nd, cols, { a, dark = false, w = 1000, h = 600 } = {}) {
	const n = cols.length, names = nd.names, b = names.length;
	const m = softmaxMatrix(namingMatrix(cols, nd), a ?? nd.softmax.a, nd.softmax.th);
	const bc = dark ? "#000000" : "#FFFFFF", fc = dark ? "#FFFFFF" : "#000000";

	// layout (npc)
	const colPalW = 0.07, colMarg1 = 0.01;
	const colTot = (1 - colPalW - 2 * colMarg1) / b, colBtW = colTot * 0.8;
	const rowBtH = 0.3, rowMarg1 = 0.02;
	const rowTot = (1 - rowBtH - 2 * rowMarg1) / n, rowPalH = rowTot * 0.8;
	const colX = i => (2 * colMarg1 + colPalW + i * colTot) * w; // left of name column i (0-based)
	const rowY = j => (2 * rowMarg1 + rowBtH + j * rowTot) * h; // top of palette row j
	const cw = colBtW * w, rh = rowPalH * h;

	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${bc}"/>`;

	// header: example colors per name
	const hy = rowMarg1 * h, hh = rowBtH * h;
	const pr = 0.375 * 0.15 * Math.min(cw, hh);
	names.forEach((nm, i) => {
		const ex = nd.examples[nm];
		const x0 = colX(i);
		for (let k = 0; k < ex.hex.length; k++) {
			s += `<circle cx="${f1(x0 + ex.x[k] * cw)}" cy="${f1(hy + (1 - (ex.y[k] * 0.8 + 0.2)) * hh)}" r="${f1(pr)}" fill="${ex.hex[k]}" stroke="${ex.hex[k]}" stroke-width="0.75"/>`;
		}
		s += `<text x="${f1(x0 + cw / 2)}" y="${f1(hy + 0.9 * hh)}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${esc(nm)}</text>`;
	});

	// palette colors
	const px = colMarg1 * w, pw = colPalW * w;
	cols.forEach((c, j) => {
		const y = rowY(j);
		s += `<text x="${f1(px + 0.15 * pw)}" y="${f1(y + rh / 2)}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${j + 1}</text>`;
		s += `<rect x="${f1(px + 0.4 * pw)}" y="${f1(y)}" width="${f1(0.6 * pw)}" height="${f1(rh)}" fill="${c}" stroke="#000000" stroke-width="0.75"/>`;
	});

	// conflicts: a color with multiple names (horizontal line), or a name for multiple colors (vertical line)
	const x1 = colX(0), x2 = colX(b - 1) + cw;
	const y1 = rowY(0), y2 = rowY(n - 1) + rh;
	for (let j = 0; j < n; j++) {
		if (m[j].filter(v => v > 0).length > 1) s += `<line x1="${f1(x1)}" x2="${f1(x2)}" y1="${f1(rowY(j) + rh / 2)}" y2="${f1(rowY(j) + rh / 2)}" stroke="${fc}" stroke-width="1.5"/>`;
	}
	for (let i = 0; i < b; i++) {
		if (m.filter(r => r[i] > 0).length > 1) s += `<line x1="${f1(colX(i) + cw / 2)}" x2="${f1(colX(i) + cw / 2)}" y1="${f1(y1)}" y2="${f1(y2)}" stroke="${fc}" stroke-width="1.5"/>`;
	}

	// probabilities (dot area)
	for (let j = 0; j < n; j++) {
		for (let i = 0; i < b; i++) {
			const v = Math.sqrt(m[j][i]);
			if (v > 0) s += `<circle cx="${f1(colX(i) + cw / 2)}" cy="${f1(rowY(j) + rh / 2)}" r="${f1(0.375 * v * LINE)}" fill="${fc}" stroke="${fc}" stroke-width="0.75"><title>${esc(names[i])}: ${(m[j][i] * 100).toFixed(0)}%</title></circle>`;
		}
	}
	return s + "</svg>";
}
