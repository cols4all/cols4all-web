// Color operations ported from R, written to give the same hex codes:
// - color vision deficiency simulation (colorspace::deutan/protan/tritan, cols4all:::hex_to_gray)
// - display color temperature (cols4all:::sim_coltemp)
// - palette interpolation (grDevices::colorRampPalette, cols4all:::get_pal_n with a manual range)
// - color sorting (cols4all:::get_pal_n colorsort)

import { hexToRgb, hexToHCL } from "./color.js";

// R's round(): half to even
export function roundR(x) {
	const r = Math.round(x);
	return (Math.abs(x % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r;
}

const hex2 = v => v.toString(16).toUpperCase().padStart(2, "0");
const toHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);
const clamp01 = x => Math.min(1, Math.max(0, x));

// ---------- color vision deficiency ----------

// colorspace::deutanomaly_cvd etc. at severity 1 (Machado et al. 2009)
const CVD = {
	deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
	protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
	tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
};

// colorspace:::simulate_cvd (linear = TRUE)
function simulateCVD(hex, M) {
	const lin = hexToRgb(hex).map(v => {
		const x = v / 255;
		return 255 * (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
	});
	const out = M.map(row => {
		let y = row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2];
		y = Math.min(255, Math.max(0, y)) / 255;
		const x = y <= 0.03928 / 12.92 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
		return roundR(x * 255);
	});
	return toHex(...out);
}

// cols4all:::hex_to_gray
function hexToGray(hex) {
	const [r, g, b] = hexToRgb(hex).map(v => v / 255);
	const gray = Math.round((0.299 * r + 0.587 * g + 0.114 * b) * 1000) / 1000;
	const v = Math.floor(255 * gray + 0.5);
	return toHex(v, v, v);
}

// ---------- display color temperature ----------

// Perceived white per display color temperature; keep in sync with css/style.css (body.temp-XXXX)
// and with .coltemp_white in cols4all (R/col_temp.R)
export const COLTEMP_WHITE = { 6500: "#FFFFFF", 4000: "#F4F1EA", 2700: "#F3E6D3", 2200: "#ECD6B3" };

const BRADFORD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];

const matVec = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const matMul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
function matInv(m) {
	const [[a, b, c], [d, e, f], [g, h, i]] = m;
	const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
	const det = a * A + b * B + c * C;
	return [
		[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
		[B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
		[C / det, -(a * h - b * g) / det, (a * e - b * d) / det]
	];
}

// colorspace's sRGB <-> XYZ (C code: gamma 2.4 with 0.03928 / 0.00304 thresholds)
function csHexToXYZ(hex) {
	const [r, g, b] = hexToRgb(hex).map(v => {
		const u = v / 255;
		return u > 0.03928 ? Math.pow((u + 0.055) / 1.055, 2.4) : u / 12.92;
	});
	return [
		100 * (0.412453 * r + 0.357580 * g + 0.180423 * b),
		100 * (0.212671 * r + 0.715160 * g + 0.072169 * b),
		100 * (0.019334 * r + 0.119193 * g + 0.950227 * b)
	];
}
function csXYZToHex([X, Y, Z]) {
	const lin = [
		(3.240479 * X - 1.537150 * Y - 0.498535 * Z) / 100,
		(-0.969256 * X + 1.875992 * Y + 0.041556 * Z) / 100,
		(0.055648 * X - 0.204043 * Y + 1.057311 * Z) / 100
	].map(clamp01);
	const s = lin.map(u => (u > 0.00304 ? 1.055 * Math.pow(u, 1 / 2.4) - 0.055 : 12.92 * u));
	return toHex(...s.map(x => Math.floor(255 * x + 0.5)));
}

const coltempMatrix = {};
function getColtempMatrix(temp) {
	if (!coltempMatrix[temp]) {
		const cw = matVec(BRADFORD, csHexToXYZ(COLTEMP_WHITE[temp]));
		const w = matVec(BRADFORD, csHexToXYZ("#FFFFFF"));
		const D = [[cw[0] / w[0], 0, 0], [0, cw[1] / w[1], 0], [0, 0, cw[2] / w[2]]];
		coltempMatrix[temp] = matMul(matMul(matInv(BRADFORD), D), BRADFORD);
	}
	return coltempMatrix[temp];
}

export function simColtemp(hex, temp = "6500") {
	if (String(temp) === "6500") return hex;
	return csXYZToHex(matVec(getColtempMatrix(String(temp)), csHexToXYZ(hex)));
}

// cols4all:::sim_cvd: vector of colors, cvd one of none, bw, deutan, protan, tritan
export function simCVD(cols, cvd = "none", temp = "6500") {
	return cols.map(c => {
		if (!c) return c;
		let x = c;
		if (cvd === "bw") x = hexToGray(c);
		else if (CVD[cvd]) x = simulateCVD(c, CVD[cvd]);
		return simColtemp(x, temp);
	});
}

// ---------- interpolation: grDevices::colorRampPalette ----------

// grDevices sRGB color converter (primaries + D65 white as in R)
const R_M = [[0.41682134188531689, 0.214923504409616523, 0.019538500400874244],
	[0.35657671707797461, 0.713153434155949228, 0.118858905692658320],
	[0.17980765358608539, 0.071923061434434152, 0.946986975553383070]];
const R_MINV = [[3.20652051714446440, -0.971982546201232034, 0.055838338593097919],
	[-1.52104178377365606, 1.881268651608487330, -0.204740574841358991],
	[-0.49331084879145598, 0.041672484599589318, 1.060928433268859106]];
const R_WHITE = [0.95320571254937703, 1, 1.08538438164691575];
const EPS = 216 / 24389, KAPPA = 24389 / 27;

// row vector times matrix (R: rgb %*% M)
const vecMat = (v, M) => [0, 1, 2].map(j => v[0] * M[0][j] + v[1] * M[1][j] + v[2] * M[2][j]);

function srgbToLab(rgb) {
	const lin = rgb.map(x => (x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
	const xyz = vecMat(lin, R_M);
	const f = xyz.map((v, i) => {
		const r = v / R_WHITE[i];
		return r <= EPS ? (KAPPA * r + 16) / 116 : Math.cbrt(r);
	});
	return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

function labToSrgb([L, a, b]) {
	const yr = L < KAPPA * EPS ? L / KAPPA : Math.pow((L + 16) / 116, 3);
	const fy = ((yr <= EPS ? KAPPA * yr : L) + 16) / 116;
	const fx = a / 500 + fy, fz = fy - b / 200;
	const fx3 = fx * fx * fx, fz3 = fz * fz * fz;
	const zr = fz3 <= EPS ? (116 * fz - 16) / KAPPA : fz3;
	const xr = fx3 <= EPS ? (116 * fx - 16) / KAPPA : fx3;
	const lin = vecMat([xr * R_WHITE[0], yr * R_WHITE[1], zr * R_WHITE[2]], R_MINV);
	return lin.map(x => {
		const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
		return clamp01(Math.round(v * 1e5) / 1e5);
	});
}

// Fused multiply-add a * b + c with a single rounding (emulated with Dekker's
// algorithm). R's C code approx1() computes y[i] + (y[j] - y[i]) * t, which the
// compiler of R for Apple Silicon (arm64) contracts to an FMA. This matters
// when colorRampPalette() truncates values like 112.99999999999999 vs 113.
const SPLIT = 134217729; // 2^27 + 1
function twoProd(a, b) {
	const p = a * b;
	const ca = SPLIT * a, ah = ca - (ca - a), al = a - ah;
	const cb = SPLIT * b, bh = cb - (cb - b), bl = b - bh;
	return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
}
function fma(a, b, c) {
	const [p, pe] = twoProd(a, b);
	const s = p + c;
	const bb = s - p;
	const se = (p - (s - bb)) + (c - bb);
	return s + (se + pe);
}

// stats::approxfun (linear), as in R's C code approx1()
function approx1(v, x, y) {
	const n = x.length;
	if (v <= x[0]) return y[0];
	if (v >= x[n - 1]) return y[n - 1];
	let i = 0, j = n - 1;
	while (i < j - 1) {
		const ij = Math.floor((i + j) / 2);
		if (v < x[ij]) j = ij; else i = ij;
	}
	if (v === x[j]) return y[j];
	if (v === x[i]) return y[i];
	return fma(y[j] - y[i], (v - x[i]) / (x[j] - x[i]), y[i]);
}

// grDevices::colorRampPalette(cols, space, interpolate = "linear")(n)
export function colorRampPalette(cols, n, space = "rgb") {
	let pts = cols.map(c => hexToRgb(c).map(v => v / 255));
	if (space === "Lab") pts = pts.map(srgbToLab);
	if (pts.length === 1) pts = [pts[0], pts[0]];
	const k = pts.length;
	const xk = seqLen(0, 1, k);
	const out = [];
	for (const x of seqLen(0, 1, n)) {
		let v = [0, 1, 2].map(d => approx1(x, xk, pts.map(p => p[d])));
		if (space === "Lab") v = labToSrgb(v);
		// rgb(maxColorValue = 255) truncates to integers
		out.push(toHex(...v.map(c => Math.trunc(clamp01(c) * 255))));
	}
	return out;
}

// cols4all:::rampPal
export function rampPal(pal, n, space = "rgb") {
	if (pal.length === n) return pal.slice();
	if (n === 1) return [colorRampPalette(pal, 3, space)[1]];
	return colorRampPalette(pal, n, space);
}

// R's seq(from, to, length.out = n) (seq.default)
function seqLen(from, to, n) {
	if (n === 1) return [from];
	const by = (to - from) / (n - 1);
	const x = Array.from({ length: n }, (_, i) => from + i * by);
	x[n - 1] = to;
	return x;
}

// R's seq.int(from, to, length.out = n) (C code): the second half is computed from the end
function seqInt(from, to, n) {
	if (n === 1) return [from];
	const by = (to - from) / (n - 1);
	const x = Array.from({ length: n }, (_, i) => (i < Math.floor(n / 2) ? from + i * by : to - (n - 1 - i) * by));
	x[0] = from;
	x[n - 1] = to;
	return x;
}

// cols4all:::map2divscaleID
function map2divscaleID(breaks, n = 101, range = [0, 1]) {
	const nbrks = breaks.length;
	const crange = range[1] - range[0];
	const lw = breaks[0], hg = breaks[nbrks - 1];
	const mx = Math.max(Math.abs(lw), Math.abs(hg));
	const isDiv = breaks.some(b => b < 0) && breaks.some(b => b > 0);
	const cat0 = !breaks.some(b => b === 0);
	const h = ((n - 1) / 2) + 1;
	let npos, nneg, step;
	if (isDiv && !cat0) {
		npos = breaks.filter(b => b > 0).length;
		nneg = breaks.filter(b => b < 0).length;
		step = roundR((h - 1) * crange / ((Math.max(npos, nneg) - 0.5) * 2));
	} else {
		npos = breaks.filter(b => b >= 0).length - (isDiv ? 0 : 1);
		nneg = breaks.filter(b => b <= 0).length - (isDiv ? 0 : 1);
		step = 0;
	}
	const pid = h + step, nid = h - step;
	const ids = Array(nbrks - 1).fill(h);
	if (npos > 0) {
		const s = seqLen((n - pid) / mx * hg * range[0], (n - pid) / mx * hg * range[1], npos);
		for (let i = 0; i < npos; i++) ids[nbrks - npos - 1 + i] = pid + s[i];
	}
	if (nneg > 0) {
		const s = seqLen(nid - ((nid - 1) / mx * -lw * range[1]), nid - ((nid - 1) / mx * -lw * range[0]), nneg);
		for (let i = 0; i < nneg; i++) ids[i] = s[i];
	}
	if (isDiv && cat0) ids[nneg - 1] = h;
	return ids.map(roundR);
}

// cols4all:::get_pal_n for seq/div/cyc with a manual range
// pal: palette info from <type>.json (base, space)
export function palWithRange(pal, type, n, range) {
	const [r0, r1] = range;
	if (r0 === 0 && r1 === 1) return rampPal(pal.base, n, pal.space);
	const ramp = rampPal(pal.base, 101, pal.space);
	if (type === "seq" || type === "cyc") {
		return seqLen(r0 * 100, r1 * 100, n).map(x => ramp[roundR(x)]);
	}
	const breaks = seqLen(-10, 10, n + 1);
	return map2divscaleID(breaks, 101, range).map(i => ramp[i - 1]);
}

// ---------- color sorting (get_pal_n colorsort) ----------

// R's order(): stable
const orderBy = (cols, v) => cols.map((c, i) => [c, v[i], i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);

export function sortColors(cols, type, colorsort) {
	if (!colorsort || colorsort === "orig") return cols;
	if (type === "cat") {
		const by = colorsort[0];
		const d = { H: 0, C: 1, L: 2 }[by];
		let v = cols.map(c => hexToHCL(c)[d]);
		if (by === "H") {
			const start = colorsort.length > 1 ? parseInt(colorsort.slice(1), 10) || 0 : 0;
			v = v.map(x => { x += start; return x > 360 ? x - 360 : x; });
		}
		return orderBy(cols, v);
	}
	if (type === "seq" && colorsort === "L") {
		const ls = cols.map(c => hexToHCL(c)[2]);
		const increasing = ls.slice(1).every((l, i) => Math.sign(l - ls[i]) >= 0);
		return increasing ? cols.slice().reverse() : cols;
	}
	return cols;
}
