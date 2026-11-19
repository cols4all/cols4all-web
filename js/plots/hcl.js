// Plots of the HCL Analysis tab, ported from cols4all:
// c4a_plot_hcl_space() (plotly), c4a_plot_hues(), c4a_plot_CL() and c4a_plot_fair().
// Data that R computes once (necklace colors, fairness contours, the HCL space
// sample) is exported to data/hcl.json.

import { hexToHCL } from "../color.js";
import { roundR } from "../colorops.js";

const LWD = 0.75, LINE = 14.4;
const f1 = x => +x.toFixed(2);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
let uid = 0;

// cols4all:::format_ids: 1,2,3,5 -> "1-3, 5"
function formatIds(x) {
	const out = [];
	let start = x[0], prev = x[0];
	for (let i = 1; i <= x.length; i++) {
		if (i < x.length && x[i] === prev + 1) { prev = x[i]; continue; }
		out.push(start === prev ? String(start) : `${start}-${prev}`);
		start = prev = x[i];
	}
	return out.join(", ");
}

// ---------- c4a_plot_hues() (width = "none", as in c4a_gui) ----------

export function huesSVG(hd, pal, { dark = false, size = 400 } = {}) {
	const bc = dark ? "#000000" : "#FFFFFF", fc = dark ? "#FFFFFF" : "#000000";
	const n = pal.length, Cgrey = 5;
	const cx = 0.5, cy = 0.55, rd = 0.4;
	const X = v => v * size, Y = v => (1 - v) * size;

	let s = `<svg class="plot" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${size}" height="${size}" fill="${bc}"/>`;
	const nk = hd.necklace;
	for (let i = 0; i < nk.x.length; i++) s += `<circle cx="${f1(X(nk.x[i]))}" cy="${f1(Y(nk.y[i]))}" r="1.875" fill="${nk.hex[i]}"/>`;

	const hcl = pal.map(c => hexToHCL(c));
	const H = hcl.map(h => { let v = roundR(h[0] / 3) * 3; return v === 360 ? 0 : v; });
	const C = hcl.map(h => h[1]);
	const wg = C.map(c => c <= Cgrey);
	const rad = wg.map(g => (g ? 0 : rd));
	const nwg = wg.filter(Boolean).length;
	// R: head(seq(0, 360, length.out = sum(wg) + 1), -1)
	let k = 0;
	wg.forEach((g, i) => { if (g) H[i] = (k++) * 360 / nwg; });

	const texts = [];
	for (let h = 0; h < 360; h++) {
		const ids = [];
		for (let i = 0; i < n; i++) if (H[i] === h && C[i] > Cgrey) ids.push(i);
		if (!ids.length) continue;
		texts.push({ h, txt: formatIds(ids.map(i => i + 1)) });
		if (ids.length > 1) ids.forEach((i, j) => (rad[i] += 0.02 * j));
	}
	const x = H.map((h, i) => cx + Math.sin(h / 180 * Math.PI) * rad[i]);
	const y = H.map((h, i) => cy + Math.cos(h / 180 * Math.PI) * rad[i]);
	k = 0;
	wg.forEach((g, i) => { if (g) { x[i] = nwg > 1 ? 0.5 + 0.02 * (k++) : 0.5; y[i] = 0.05; } });

	const o = rad.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(a => a[1]);
	const r = 0.375 * 2 * LINE;
	for (const i of o) s += `<circle cx="${f1(X(x[i]))}" cy="${f1(Y(y[i]))}" r="${r}" fill="${pal[i]}" stroke="${bc}" stroke-width="${6 * LWD}"/>`;
	for (const i of o) s += `<circle cx="${f1(X(x[i]))}" cy="${f1(Y(y[i]))}" r="${r}" fill="${pal[i]}" stroke="${fc}" stroke-width="${LWD}"/>`;

	for (const t of texts) {
		const anchor = (t.h > 225 && t.h < 315) ? "start" : (t.h > 45 && t.h < 135) ? "end" : "middle";
		const tx = cx + Math.sin(t.h / 180 * Math.PI) * 0.35, ty = cy + Math.cos(t.h / 180 * Math.PI) * 0.35;
		s += `<text x="${f1(X(tx))}" y="${f1(Y(ty))}" fill="${fc}" font-size="12" text-anchor="${anchor}" dominant-baseline="central">${esc(t.txt)}</text>`;
	}
	if (nwg) {
		const ids = wg.map((g, i) => (g ? i + 1 : 0)).filter(Boolean);
		s += `<text x="${f1(X(0.45))}" y="${f1(Y(0.05))}" fill="${fc}" font-size="12" text-anchor="end" dominant-baseline="central">(Almost) grayscale: ${formatIds(ids)}</text>`;
	}
	return s + "</svg>";
}

// ---------- common frame of c4a_plot_CL() and c4a_plot_fair() ----------
// square plot; layout widths (2.5 lines, null, 1 line), heights (1 line, null, 2.5 lines)

function frame(size, dark, ylab, xlab, body) {
	const fc = dark ? "#FFFFFF" : "#000000", bc = dark ? "#000000" : "#FFFFFF";
	const gc = dark ? "#222222" : "#EEEEEE", dc = dark ? "#BBBBBB" : "#555555";
	const x0 = 2.5 * LINE, x1 = size - LINE, y0 = LINE, y1 = size - 2.5 * LINE;
	const X = c => x0 + c / 180 * (x1 - x0), Y = l => y1 - l / 100 * (y1 - y0);
	const id = "clip" + (++uid);
	let s = `<svg class="plot" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
		+ `<rect width="${size}" height="${size}" fill="${bc}"/>`
		+ `<defs><clipPath id="${id}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath></defs>`
		+ `<g clip-path="url(#${id})"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${gc}" stroke="${fc}" stroke-width="${LWD}"/>`
		+ body({ X, Y, fc, bc, gc, dc }) + `</g>`;
	// y axis
	for (let v = 10; v <= 90; v += 10) {
		s += `<line x1="${f1(0.85 * x0)}" x2="${x0}" y1="${f1(Y(v))}" y2="${f1(Y(v))}" stroke="${fc}" stroke-width="${LWD}"/>`
			+ `<text x="${f1(0.75 * x0)}" y="${f1(Y(v))}" fill="${fc}" font-size="9.6" text-anchor="end" dominant-baseline="central">${v}</text>`;
	}
	s += `<text transform="translate(${f1(0.2 * x0)},${f1((y0 + y1) / 2)}) rotate(-90)" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${ylab}</text>`;
	// x axis
	const h = size - y1;
	for (let v = 20; v <= 160; v += 20) {
		s += `<line x1="${f1(X(v))}" x2="${f1(X(v))}" y1="${f1(size - 0.85 * h)}" y2="${f1(y1)}" stroke="${fc}" stroke-width="${LWD}"/>`
			+ `<text x="${f1(X(v))}" y="${f1(size - 0.65 * h)}" fill="${fc}" font-size="9.6" text-anchor="middle" dominant-baseline="central">${v}</text>`;
	}
	s += `<text x="${f1((x0 + x1) / 2)}" y="${f1(size - 0.2 * h)}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${xlab}</text>`;
	return s + "</svg>";
}

// a rectangle of w x h native units (C, L) centered at (c, l)
const nrect = (X, Y, c, l, w, h, attrs) =>
	`<rect x="${f1(X(c - w / 2))}" y="${f1(Y(l + h / 2))}" width="${f1(X(w) - X(0))}" height="${f1(Y(0) - Y(h))}" ${attrs}/>`;

// ---------- c4a_plot_CL() ----------

export function clSVG(cols, { dark = false, size = 600, Lrange = true } = {}) {
	const m = cols.map(c => hexToHCL(c));
	const Cs = m.map(x => x[1]), Ls = m.map(x => x[2]);
	const cr = [Math.min(...Cs), Math.max(...Cs)], lr = [Math.min(...Ls), Math.max(...Ls)];
	const marg = 1.5, sq = 2;
	const cr2 = [cr[0] - marg * 1.8, cr[1] + marg * 1.8], lr2 = [lr[0] - marg, lr[1] + marg];
	return frame(size, dark, "Luminance", "Chroma", ({ X, Y, fc, bc, gc, dc }) => {
		const line = (pts, col) => `<polyline points="${pts.map(([c, l]) => `${f1(X(c))},${f1(Y(l))}`).join(" ")}" fill="none" stroke="${col}" stroke-width="${LWD}"/>`;
		let s = nrect(X, Y, (cr2[0] + cr2[1]) / 2, (lr2[0] + lr2[1]) / 2, cr2[1] - cr2[0], lr2[1] - lr2[0], `fill="${bc}"`);
		const b = lr2[0];
		s += line([[cr[0], b - marg * 0.5], [cr[0], b - marg * 1.5]], dc)
			+ line([[cr[0], b - marg], [cr[1], b - marg]], dc)
			+ line([[cr[1], b - marg * 0.5], [cr[1], b - marg * 1.5]], dc);
		s += nrect(X, Y, (cr2[0] + cr2[1]) / 2, b - marg * 2.75, cr2[1] - cr2[0], marg * 2, `fill="${gc}"`);
		s += `<text x="${f1(X((cr2[0] + cr2[1]) / 2))}" y="${f1(Y(b - marg * 2.5))}" fill="${fc}" font-size="9.6" text-anchor="middle" dominant-baseline="central">C range: ${roundR(cr[1] - cr[0])}</text>`;
		if (Lrange) {
			const xs = [0.5, 1.5, 1, 1, 0.5, 1.5].map(v => cr2[1] + v * marg * 1.8);
			s += line([[xs[0], lr[0]], [xs[1], lr[0]]], dc) + line([[xs[2], lr[0]], [xs[3], lr[1]]], dc) + line([[xs[4], lr[1]], [xs[5], lr[1]]], dc);
			s += `<text transform="translate(${f1(X(cr2[1] + marg * 2.5 * 1.8))},${f1(Y((lr2[0] + lr2[1]) / 2))}) rotate(-90)" fill="${fc}" font-size="9.6" text-anchor="middle" dominant-baseline="central">L range: ${roundR(lr[1] - lr[0])}</text>`;
		}
		cols.forEach((c, i) => {
			s += nrect(X, Y, Cs[i], Ls[i], sq * 1.8, sq, `fill="${c}" stroke="${fc}" stroke-width="${LWD}"`);
		});
		cols.forEach((c, i) => {
			s += `<text x="${f1(X(Cs[i]) + 0.75 * LINE)}" y="${f1(Y(Ls[i]))}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
		});
		return s;
	});
}

// ---------- fairness (cols4all:::get_fairness) ----------

export function getFairness(dL, dC, fp, round = true) {
	const logit = (x, mid, steep) => 1 / (1 + Math.exp(-(x - mid) * steep));
	const before = (l, c) => (1 - logit(l, fp.Lrange_mid, fp.Lrange_steep)) * (1 - logit(c, fp.Crange_mid, fp.Crange_steep));
	const f = before(dL, dC) / before(0, 0) * 100;
	return round ? roundR(f) : f;
}

// ---------- c4a_plot_fair() ----------

export function fairSVG(hd, pal, { type = "LC", dark = false, size = 600 } = {}) {
	const fp = hd.fairness;
	const m = pal.map(c => hexToHCL(c));
	const Cs = m.map(x => x[1]), Ls = m.map(x => x[2]);
	let cr = Math.max(...Cs) - Math.min(...Cs);
	const marg = 1.5, sq = 2;
	const marker = (X, Y, fc, bc, gc, c, l, v) =>
		nrect(X, Y, c, l, sq * 1.8, sq, `fill="${fc}" stroke="${bc}" stroke-width="${LWD}"`)
		+ `<rect x="${f1(X(c) + 0.75 * LINE)}" y="${f1(Y(l) - LINE / 2)}" width="${LINE}" height="${LINE}" fill="${gc}"/>`
		+ `<text x="${f1(X(c) + 0.75 * LINE)}" y="${f1(Y(l))}" fill="${fc}" font-size="12" dominant-baseline="central">${v}</text>`;

	if (type === "LC") {
		let lr = Math.max(...Ls) - Math.min(...Ls);
		const LC = getFairness(lr, cr, fp);
		return frame(size, dark, "Luminance range", "Chroma range", ({ X, Y, fc, bc, gc, dc }) => {
			let s = "";
			for (const cl of fp.contours) {
				s += `<polyline points="${cl.C.map((c, i) => `${f1(X(c))},${f1(Y(cl.L[i]))}`).join(" ")}" fill="none" stroke="${dc}" stroke-width="${LWD}"/>`;
				s += `<rect x="${f1(X(cl.labC) - 0.65 * LINE)}" y="${f1(Y(cl.labL) - 0.5 * LINE)}" width="${f1(1.3 * LINE)}" height="${LINE}" fill="${gc}"/>`;
				s += `<text x="${f1(X(cl.labC))}" y="${f1(Y(cl.labL))}" fill="${fc}" font-size="12" text-anchor="middle" dominant-baseline="central">${cl.level}</text>`;
			}
			if (cr < marg * 1.8) cr = marg * 1.8;
			if (lr < marg) lr = marg;
			return s + marker(X, Y, fc, bc, gc, cr, lr, LC);
		});
	}
	const LC = getFairness(0, cr, fp);
	return frame(size, dark, "Fairness", "Chroma range", ({ X, Y, fc, bc, gc }) => {
		let s = `<polyline points="${fp.C.map((c, i) => `${f1(X(c))},${f1(Y(fp.F[i]))}`).join(" ")}" fill="none" stroke="${fc}" stroke-width="${LWD}"/>`;
		return s + marker(X, Y, fc, bc, gc, cr, LC, LC);
	});
}

// ---------- c4a_plot_hcl_space() (plotly) ----------

const PLOTLY = "https://cdn.jsdelivr.net/npm/plotly.js-gl3d-dist-min@2.35.2/plotly-gl3d.min.js";
let plotlyPromise = null;
function loadPlotly() {
	if (!plotlyPromise) {
		plotlyPromise = new Promise((resolve, reject) => {
			const sc = document.createElement("script");
			sc.src = PLOTLY;
			sc.onload = () => resolve(window.Plotly);
			sc.onerror = () => reject(new Error("Could not load plotly"));
			document.head.appendChild(sc);
		});
	}
	return plotlyPromise;
}

export async function hclSpace(el, hd, { H = [0, 360], C = [0, 180], L = [0, 100], colors = null, dark = false } = {}) {
	const Plotly = await loadPlotly();
	const sp = hd.space;
	const fc = dark ? "#FFFFFF" : "#000000";
	let pts;
	if (colors) {
		pts = colors.map((hex, i) => {
			const [h, c, l] = hexToHCL(hex);
			return { x: Math.sin(h / 180 * Math.PI) * c, y: Math.cos(h / 180 * Math.PI) * c, z: l, hex,
				text: `Color ${i + 1}<br>${hex}<br>H ${roundR(h)}, C ${roundR(c)}, L ${roundR(l)}` };
		});
	} else {
		pts = [];
		for (let i = 0; i < sp.x.length; i++) {
			if (sp.H[i] >= H[0] && sp.H[i] <= H[1] && sp.C[i] >= C[0] && sp.C[i] <= C[1] && sp.L[i] >= L[0] && sp.L[i] <= L[1]) {
				pts.push({ x: sp.x[i], y: sp.y[i], z: sp.L[i], hex: sp.hex[i],
					text: `${sp.hex[i]}<br>H ${roundR(sp.H[i])}, C ${roundR(sp.C[i])}, L ${roundR(sp.L[i])}` });
			}
		}
	}
	const add = (deg, c) => [Math.sin(deg / 180 * Math.PI) * c, Math.cos(deg / 180 * Math.PI) * c];
	const Hlab = Array.from({ length: 12 }, (_, i) => i * 30).map(h => [...add(h, 180 * 1.1), h]);
	const Clab = [45, 90, 135].map(c => [...add(180, c), c]);
	const gx = sp.grid.x.map(v => v ?? null), gy = sp.grid.y.map(v => v ?? null), gz = sp.grid.z.map(v => v ?? null);
	const text = (x, y, z, t, pos) => ({ type: "scatter3d", mode: "text", x, y, z, text: t, textposition: pos,
		textfont: { size: 12, color: fc }, hoverinfo: "none", showlegend: false });
	const data = [
		{ type: "scatter3d", mode: "markers", x: pts.map(p => p.x), y: pts.map(p => p.y), z: pts.map(p => p.z),
			marker: { color: pts.map(p => p.hex) }, hoverinfo: "text", text: pts.map(p => p.text), showlegend: false },
		{ type: "scatter3d", mode: "lines", x: gx, y: gy, z: gz, line: { width: 2, color: "#CBCBCB" }, hoverinfo: "none", showlegend: false },
		{ type: "scatter3d", mode: "lines", x: gx, y: gy, z: gz.map(v => (v === null ? null : 0)), line: { width: 2, color: fc }, hoverinfo: "none", showlegend: false },
		text(Hlab.map(a => a[0]), Hlab.map(a => a[1]), Hlab.map(() => 0), Hlab.map(a => String(a[2])), "middle center"),
		text(sp.z_breaks.map(() => 0), sp.z_breaks.map(() => 1.05 * sp.r), sp.z_breaks.map(z => z * 0.95), sp.z_breaks.map(String), "middle left"),
		text(Clab.map(a => a[0]), Clab.map(a => a[1]), Clab.map(() => 0), Clab.map(a => String(a[2])), "middle left")
	];
	const ax = { title: "", zeroline: false, showline: false, showticklabels: false, showgrid: false, showspikes: false, showbackground: false };
	const xy = { ...ax, range: [-1.05 * 1.1 * sp.r, 1.05 * 1.1 * sp.r] };
	const layout = {
		margin: { l: 0, r: 0, t: 0, b: 0 },
		paper_bgcolor: "rgba(0,0,0,0)",
		plot_bgcolor: "rgba(0,0,0,0)",
		scene: { camera: { eye: { x: 0.8, y: 0.8, z: 0.8 } }, aspectratio: { x: 1, y: 1, z: 0.5 }, dragmode: "turntable",
			xaxis: xy, yaxis: xy, zaxis: ax }
	};
	await Plotly.react(el, data, layout, { displaylogo: false, responsive: true });
}
