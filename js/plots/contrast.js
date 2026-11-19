// Plots of the Contrast tab, ported from cols4all:
// c4a_plot_CR(), plot_matrix() (contrast ratio matrix; also used for the
// separability matrices), c4a_plot_text2(), c4a_plot_bars() and
// c4a_plot_Plus_Reversed().
//
// R plots are rendered at 72 dpi: 1 pt = 1 px, lwd 1 = 0.75 px, and one line
// of text (base graphics margins, grid "lines") = 1.2 * 12 = 14.4 px.

import { hexToRgb } from "../color.js";

const LWD = 0.75;
const LINE = 14.4;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const f1 = x => +x.toFixed(2);

// ---------- contrast ratio (colorspace::contrast_ratio, WCAG) ----------

export function relLuminance(hex) {
	const [r, g, b] = hexToRgb(hex).map(v => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(c1, c2 = "#FFFFFF") {
	const r = (relLuminance(c1) + 0.05) / (relLuminance(c2) + 0.05);
	return r < 1 ? 1 / r : r;
}

// cols4all:::get_CR_matrix (diagonal NA)
export function crMatrix(p) {
	return p.map((a, i) => p.map((b, j) => (i === j ? null : contrastRatio(a, b))));
}

// ---------- R's pretty() ----------

export function pretty(lo, hi, n = 5) {
	const h = 1.5, h5 = 0.5 + 1.5 * h;
	const dx = hi - lo;
	let cell = dx === 0 ? Math.abs(lo) || 1 : dx;
	if (n > 1) cell /= n;
	const base = Math.pow(10, Math.floor(Math.log10(cell)));
	let unit = base, ns;
	if ((ns = 2 * base) - cell < h * (cell - unit)) {
		unit = ns;
		if ((ns = 5 * base) - cell < h5 * (cell - unit)) {
			unit = ns;
			if ((ns = 10 * base) - cell < h * (cell - unit)) unit = ns;
		}
	}
	let a = Math.floor(lo / unit + 1e-7), b = Math.ceil(hi / unit - 1e-7);
	while (a * unit > lo + 1e-10 * unit) a--;
	while (b * unit < hi - 1e-10 * unit) b++;
	const out = [];
	for (let i = a; i <= b; i++) out.push(+(i * unit).toPrecision(12));
	return out;
}

// ---------- plot symbols (R's pch, as drawn by the graphics engine) ----------

const RADIUS = 0.375, SQRC = 0.88622692545275801364;
const TRC0 = 1.55512030155621416073, TRC1 = 1.34677368708859836060, TRC2 = 0.77756015077810708036;

// size: symbol size in px (grid size / base cex * fontsize)
export function pchSVG(pch, x, y, size, col, lwd = 1) {
	const sw = `stroke="${col}" stroke-width="${lwd * LWD}"`;
	const r = RADIUS * size;
	switch (pch) {
		case 0: return `<rect x="${f1(x - r)}" y="${f1(y - r)}" width="${f1(2 * r)}" height="${f1(2 * r)}" fill="none" ${sw}/>`;
		case 15: { const s = r * SQRC; return `<rect x="${f1(x - s)}" y="${f1(y - s)}" width="${f1(2 * s)}" height="${f1(2 * s)}" fill="${col}"/>`; }
		case 1: return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="none" ${sw}/>`;
		case 16: return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col}"/>`;
		case 2: case 17: {
			const rr = TRC0 * r, xc = TRC1 * r, yc = TRC2 * r;
			const pts = `${f1(x)},${f1(y - rr)} ${f1(x + xc)},${f1(y + yc)} ${f1(x - xc)},${f1(y + yc)}`;
			return pch === 2 ? `<polygon points="${pts}" fill="none" ${sw}/>` : `<polygon points="${pts}" fill="${col}"/>`;
		}
		default: return "";
	}
}

// ---------- plot_matrix() ----------

// Index of the symbol class (cols4all:::symbol_size)
function symbolClass(v, brks) {
	for (let i = 1; i < brks.length; i++) if (v <= brks[i]) return i - 1;
	return brks.length - 1;
}

// m: n x n matrix (null = no symbol), p: (simulated) colors, spec: { pchs, sizes, labels, breaks, title }
// id1: selected row, id2: selected column (0-based).
// Returns { svg, hit(x, y) -> {row, col} } where the coordinates are in the svg coordinate system.
export function matrixSVG(m, p, spec, { id1 = null, id2 = null, dark = false, showNumbers = false, numberFormat = v => v.toFixed(2), w = 400, h = 300 } = {}) {
	const n = p.length;
	const fc = dark ? "#FFFFFF" : "#000000", bc = dark ? "#000000" : "#FFFFFF";
	const cex = Math.min(1, 12 / n), cex2 = Math.min(1, 8 / n);
	const line = LINE * cex;

	// viewport of 1.25 x 1 snpc (wide devices) or 1 x 0.8 snpc
	const snpc = Math.min(w, h);
	let vw, vh;
	if (w / h > 1.25) { vw = 1.25 * snpc; vh = snpc; } else { vw = snpc; vh = 0.8 * snpc; }
	const vx = (w - vw) / 2, vy = (h - vh) / 2;
	// left: 80% (matrix, in a 90% viewport), right: 20% (legend)
	const lw = 0.8 * vw;
	const gw = lw * 0.9, gh = vh * 0.9;
	const gx = vx + (lw - gw) / 2, gy = vy + (vh - gh) / 2;
	const cw = gw / (n + 1), ch = gh / (n + 1);
	const cs = Math.min(cw, ch);
	const cellX = j => gx + (j + 1) * cw, cellY = i => gy + (i + 1) * ch; // top-left of cell (row i, col j), 0-based

	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${bc}"/>`;
	s += `<line x1="${f1(cellX(0))}" y1="${f1(cellY(0))}" x2="${f1(gx + gw)}" y2="${f1(gy + gh)}" stroke="${fc}" stroke-width="${2 * LWD}"/>`;

	const swatch = (x, y, col, selected) => {
		let r = `<rect x="${f1(x + cw * 0.05)}" y="${f1(y + ch * 0.05)}" width="${f1(cw * 0.9)}" height="${f1(ch * 0.9)}" fill="${col}" stroke="#000000" stroke-width="${LWD}"/>`;
		if (selected) {
			const cx = x + cw / 2, cy = y + ch / 2;
			r += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(0.17 * cs)}" fill="#FFFFFF"/>`
				+ `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(0.1 * cs)}" fill="none" stroke="#000000" stroke-width="${2 * LWD}"/>`;
		}
		return r;
	};

	for (let i = 0; i < n; i++) {
		s += swatch(gx, cellY(i), p[i], i === id1);
		s += swatch(cellX(i), gy, p[i], i === id2);
		for (let j = 0; j < n; j++) {
			const v = m[i][j];
			if (v === null || v === undefined || Number.isNaN(v)) continue;
			const k = symbolClass(v, spec.breaks);
			const cx = cellX(j) + cw / 2, cy = cellY(i) + ch / 2;
			s += pchSVG(spec.pchs[k], cx, cy, spec.sizes[k] * line, fc);
			if (showNumbers) {
				s += `<text x="${f1(cx)}" y="${f1(cellY(i) + ch * 0.8)}" fill="${fc}" font-size="${f1(12 * cex * cex2)}" text-anchor="middle" dominant-baseline="central">${esc(numberFormat(v))}</text>`;
			}
			if (i === id1 && j === id2) {
				s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(0.4 * cs)}" fill="none" stroke="${fc}" stroke-width="${1.5 * LWD}" stroke-dasharray="1.5 3"/>`;
			}
		}
	}

	// legend
	const lx = vx + lw, row = 1.25 * line;
	const symX = lx + 0.25 * line + 0.5 * line, txtX = lx + 0.25 * line + line + 0.25 * line;
	s += `<text x="${f1(lx + 0.25 * line)}" y="${f1(vy + 1.5 * row)}" fill="${fc}" font-size="${f1(12 * cex)}" dominant-baseline="central">${esc(spec.title)}</text>`;
	spec.labels.forEach((lab, i) => {
		const y = vy + (2.5 + i) * row;
		s += pchSVG(spec.pchs[i], symX, y, spec.sizes[i] * line, fc);
		s += `<text x="${f1(txtX)}" y="${f1(y)}" fill="${fc}" font-size="${f1(12 * cex * 0.9)}" dominant-baseline="central">${esc(lab)}</text>`;
	});
	s += "</svg>";

	const hit = (x, y) => {
		const c = Math.floor((x - gx) / cw) - 1, r = Math.floor((y - gy) / ch) - 1;
		return { row: r >= 0 && r < n ? r : null, col: c >= 0 && c < n ? c : null };
	};
	return { svg: s, hit };
}

// ---------- c4a_plot_CR() ----------

// width of a text at 12px (Helvetica, as R's default font)
let measureCtx = null;
function textWidth(txt) {
	if (typeof document === "undefined") return txt.length * 7.2;
	if (!measureCtx) {
		measureCtx = document.createElement("canvas").getContext("2d");
		measureCtx.font = "12px Helvetica, Arial, sans-serif";
	}
	return measureCtx.measureText(txt).width;
}

export function crBarSVG(p, { dark = false, sort = false, linesWCAG = true, linesEqui = true, w = 600, h = 400 } = {}) {
	let cols = p.slice();
	let cr = cols.map(c => contrastRatio(c));
	if (sort) {
		const ord = cr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[1]);
		cr = ord.map(i => cr[i]);
		cols = ord.map(i => cols[i]);
	}
	const bc = dark ? "#000000" : "#FFFFFF", fc = dark ? "#FFFFFF" : "#000000";
	const lc1 = "#B3B3B3", lc2 = dark ? "#CCCCCC" : "#4D4D4D"; // gray70, gray80 / gray30
	if (dark) cr = cr.map(v => 21 / v);
	cr = cr.map(v => v - 1);
	const n = cols.length;
	const crWCAG = linesWCAG ? 7.2 : 0;

	// equiluminant groups (contrast ratio <= 1.2 between colors)
	let groups = null;
	if (linesEqui) {
		const crm = crMatrix(cols);
		let el = [];
		for (let c1 = 0; c1 < n; c1++) for (let c2 = c1 + 1; c2 < n; c2++) {
			if (crm[c1][c2] <= 1.2) el.push({ c1, c2, c3: [], red: false });
		}
		// R: which(crm <= 1.2) in column-major order (c1 = column, c2 = row), keeping c1 < c2
		el.forEach((e, i) => {
			const p1 = el.filter(x => x.c1 === e.c1).map(x => x.c2);
			const p2 = el.filter(x => x.c1 === e.c2).map(x => x.c2);
			const partners = p1.filter(x => p2.includes(x));
			if (partners.length) {
				e.c3 = partners;
				const c123 = [e.c1, e.c2, ...partners];
				el.forEach((x, j) => { if (j !== i && c123.includes(x.c1) && c123.includes(x.c2)) x.red = true; });
			}
		});
		el = el.filter(e => !e.red);
		if (el.length) {
			groups = el.map(e => {
				const cs = [e.c1, e.c2, ...e.c3];
				return { cs, ceil: Math.max(...cs.map(c => cr[c])) + 0.2 };
			});
		}
	}
	const crmax = Math.max(...cr, crWCAG, ...(groups ? groups.map(g => g.ceil) : []));
	const ytop = Math.ceil(crmax);

	// plot region (mar = c(5.1, 4.1, 4.1, 2.1) lines)
	const L = 4.1 * LINE, R = w - 2.1 * LINE, T = 4.1 * LINE, B = h - 5.1 * LINE;
	const xl = 0.2, xr = n * 1.2, ext = (xr - xl) * 0.04;
	const X = v => L + (v - (xl - ext)) / ((xr + ext) - (xl - ext)) * (R - L);
	const Y = v => B - v / ytop * (B - T);

	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${bc}"/>`;

	// y axis
	let brks = pretty(0, ytop, 7);
	if (linesWCAG) brks = [...new Set([...brks, 2, 3.5, 6])].sort((a, b) => a - b);
	const labs = brks.map(b => {
		const v = +(b + 1).toPrecision(12);
		if (!linesWCAG) return String(v);
		return v === 3 ? "A - 3" : v === 4.5 ? "AA - 4.5" : v === 7 ? "AAA - 7" : String(v);
	});
	s += `<line x1="${L}" x2="${L}" y1="${f1(Y(brks[0]))}" y2="${f1(Y(brks[brks.length - 1]))}" stroke="#000000" stroke-width="${LWD}"/>`;
	brks.forEach((b, i) => {
		s += `<line x1="${L - 0.5 * LINE}" x2="${L}" y1="${f1(Y(b))}" y2="${f1(Y(b))}" stroke="#000000" stroke-width="${LWD}"/>`;
		s += `<text x="${f1(L - LINE)}" y="${f1(Y(b))}" fill="${fc}" font-size="12" text-anchor="end" dominant-baseline="central">${esc(labs[i])}</text>`;
	});

	if (linesWCAG) {
		for (const v of [2, 3.5, 6]) s += `<line x1="${L}" x2="${R}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" stroke="${lc1}" stroke-width="${2 * LWD}"/>`;
	}

	// bars and labels (labels that would overlap the previous one are skipped, as in R)
	let lastRight = -Infinity;
	const gap = textWidth("m"); // R's axis(): gap.axis = 1 ("m" widths)
	cols.forEach((c, i) => {
		const x0 = 0.2 + i * 1.2;
		s += `<rect x="${f1(X(x0))}" y="${f1(Y(cr[i]))}" width="${f1(X(x0 + 1) - X(x0))}" height="${f1(Y(0) - Y(cr[i]))}" fill="${c}" stroke="#000000" stroke-width="${LWD}"/>`;
		const cx = X(x0 + 0.5), lw = textWidth(c);
		if (cx - lw / 2 > lastRight + gap) {
			s += `<text x="${f1(cx)}" y="${f1(B + LINE + 6)}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${esc(c)}</text>`;
			lastRight = cx + lw / 2;
		}
	});

	if (groups) {
		const dot = `stroke="${lc2}" stroke-width="${3 * LWD}" stroke-dasharray="2.5 3"`;
		const co = i => X(0.2 + i * 1.2 + 0.5);
		for (const g of groups) {
			s += `<line x1="${f1(co(g.cs[0]))}" x2="${f1(co(g.cs[g.cs.length - 1]))}" y1="${f1(Y(g.ceil))}" y2="${f1(Y(g.ceil))}" ${dot}/>`;
			for (const c of g.cs) s += `<line x1="${f1(co(c))}" x2="${f1(co(c))}" y1="${f1(Y(cr[c]))}" y2="${f1(Y(g.ceil))}" ${dot}/>`;
		}
	}
	return s + "</svg>";
}

// ---------- c4a_plot_text2() ----------

export function text2SVG(c1, c2, { dark = false, w = 400, h = 200 } = {}) {
	const cw = (w - 2 * LINE) / 2, ch = (h - 2 * LINE) / 2;
	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${dark ? "#000000" : "#FFFFFF"}"/>`;
	const cell = (x, y, bg, fg, size) =>
		`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(cw)}" height="${f1(ch)}" fill="${bg}"/>`
		+ `<text x="${f1(x + cw / 2)}" y="${f1(y + ch / 2)}" fill="${fg}" font-size="${size}" text-anchor="middle" dominant-baseline="central">Font size ${size}pt</text>`;
	s += cell(0, 0, c1, c2, 14) + cell(0, ch + LINE, c2, c1, 14) + cell(cw + LINE, 0, c1, c2, 18) + cell(cw + LINE, ch + LINE, c2, c1, 18);
	return s + "</svg>";
}

// ---------- c4a_plot_bars() ----------

export function barsSVG(ex, c1, c2, { borders = "black", lwd = 0, dark = false, w = 600, h = 300 } = {}) {
	const x = ex.bars;
	const fc = dark ? "#FFFFFF" : "#000000";
	const L = 4.1 * LINE, R = w - 2.1 * LINE, T = 4.1 * LINE, B = h - 5.1 * LINE;
	const n = x.length, xl = 0.2, xr = n * 1.2, ext = (xr - xl) * 0.04;
	const X = v => L + (v - (xl - ext)) / ((xr + ext) - (xl - ext)) * (R - L);
	const Y = v => B - v / 100 * (B - T);
	const stroke = lwd > 0 ? `stroke="${borders}" stroke-width="${LWD}"` : "";
	let s = `<svg class="plot" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${w}" height="${h}" fill="${dark ? "#000000" : "#FFFFFF"}"/>`;
	x.forEach((v, i) => {
		const x0 = X(0.2 + i * 1.2), x1 = X(1.2 + i * 1.2);
		s += `<rect x="${f1(x0)}" y="${f1(Y(v))}" width="${f1(x1 - x0)}" height="${f1(Y(0) - Y(v))}" fill="${c1}" ${stroke}/>`;
		s += `<rect x="${f1(x0)}" y="${f1(Y(100))}" width="${f1(x1 - x0)}" height="${f1(Y(v) - Y(100))}" fill="${c2}" ${stroke}/>`;
		if (lwd > 0) s += `<line x1="${f1(x0)}" x2="${f1(x1)}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" stroke="${borders}" stroke-width="${lwd * LWD}"/>`;
		s += `<text x="${f1((x0 + x1) / 2)}" y="${f1(B + LINE + 6)}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${"ABCDE"[i]}</text>`;
	});
	// y axis (labels parallel to the axis)
	s += `<line x1="${L}" x2="${L}" y1="${f1(Y(0))}" y2="${f1(Y(100))}" stroke="${fc}" stroke-width="${LWD}"/>`;
	for (let v = 0; v <= 100; v += 20) {
		s += `<line x1="${L - 0.5 * LINE}" x2="${L}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" stroke="${fc}" stroke-width="${LWD}"/>`;
		s += `<text transform="translate(${f1(L - LINE - 4)},${f1(Y(v))}) rotate(-90)" fill="${fc}" font-size="12" text-anchor="middle">${v}</text>`;
	}
	s += `<text x="${f1((L + R) / 2)}" y="${f1(B + 3 * LINE + 4)}" fill="${fc}" font-size="12" text-anchor="middle">Group</text>`;
	s += `<text transform="translate(${f1(L - 3 * LINE + 2)},${f1((T + B) / 2)}) rotate(-90)" fill="${fc}" font-size="12" text-anchor="middle">Percentage</text>`;
	return s + "</svg>";
}

// ---------- c4a_plot_Plus_Reversed() ----------

const imgCache = {};
function loadImage(src) {
	if (!imgCache[src]) {
		imgCache[src] = new Promise((resolve, reject) => {
			const im = new Image();
			im.onload = () => {
				const c = document.createElement("canvas");
				c.width = im.naturalWidth; c.height = im.naturalHeight;
				const ctx = c.getContext("2d");
				ctx.drawImage(im, 0, 0);
				resolve(ctx.getImageData(0, 0, c.width, c.height));
			};
			im.onerror = reject;
			im.src = src;
		});
	}
	return imgCache[src];
}

// Draws on canvas (landscape orientation)
export async function plusReversed(canvas, { col1 = "#A93028", col2 = "#1F6758", borders = "black", lwd = 0 } = {}) {
	const x = await loadImage("img/plus_rev.png");
	const y = lwd > 0 ? await loadImage("img/plus_rev_borders.png") : null;
	const W0 = x.width, H0 = x.height; // portrait: 937 x 1200
	const W = H0, H = W0; // landscape (transposed)
	canvas.width = W; canvas.height = H;
	const ctx = canvas.getContext("2d");
	const out = ctx.createImageData(W, H);
	const a = hexToRgb(col1), b = hexToRgb(col2);
	const bcol = borders === "black" ? [0, 0, 0] : [255, 255, 255];
	const thr = [0.4, 0.5, 0.8][lwd - 1];
	const ref = x.data[0];
	for (let r = 0; r < H; r++) {
		for (let c = 0; c < W; c++) {
			const src = (c * W0 + r) * 4; // transposed: new (r, c) = old (c, r)
			let col = x.data[src] === ref ? a : b;
			if (y && Math.round(y.data[src] / 255 * 10) / 10 <= thr) col = bcol;
			const dst = (r * W + c) * 4;
			out.data[dst] = col[0]; out.data[dst + 1] = col[1]; out.data[dst + 2] = col[2]; out.data[dst + 3] = 255;
		}
	}
	ctx.putImageData(out, 0, 0);
}
