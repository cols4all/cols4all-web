// Scores of palettes, ported from cols4all, so that palettes entered by the
// user get the same scores as the built-in palettes (which are computed in R,
// see R/export_data.R):
// - check_cat_pal(), check_seq_pal(), check_div_pal(), check_cyc_pal(), hcl_prop(), rgb_prop()
// - show_attach_scores() and get_friendlyness()
// - process_palette() (color for missing values), range_seq()/range_div()/range_cyc() and get_pal_n()
// - check_bivs_pal(), check_bivc_pal(), check_bivd_pal(), check_bivg_pal()
//
// Bivariate palettes are matrices: arrays of rows (rows = m, columns = n).

import { hexToRgb, hexToLAB, hexToHCL } from "./color.js";
import { simCVD, roundR, rampPal, palWithRange } from "./colorops.js";
import { probMatrix } from "./plots/cvd.js";
import { namingMatrix, softmaxMatrix } from "./plots/naming.js";
import { contrastRatio } from "./plots/contrast.js";
import { getFairness } from "./plots/hcl.js";

// .C4A settings (R/onLoad.R)
export const C4A = {
	CBF_th: { cat: { min_dist: 90 }, seq: { min_dist: 5, tri_ineq: 2 }, cyc: { min_dist: 5, tri_ineq: 2 }, div: { inter_wing_dist: 10, min_step: 5, tri_ineq: 2 },
		bivs: { inter_wing_dist: 7, min_step: 3 }, bivc: { min_dist: 90 }, bivd: { inter_wing_dist: 7, min_step: 3 }, bivg: { inter_wing_dist: 7, min_step: 3 } },
	CBVF_th: { cat: { min_dist: 95 } },
	CBU_th: { cat: { min_dist: 50 }, seq: { min_dist: 2, tri_ineq: 0 }, cyc: { min_dist: 2, tri_ineq: 0 }, div: { inter_wing_dist: 4, min_step: 2, tri_ineq: 0 },
		bivs: { inter_wing_dist: 3, min_step: 2 }, bivc: { min_dist: 50 }, bivd: { inter_wing_dist: 3, min_step: 2 }, bivg: { inter_wing_dist: 3, min_step: 2 } },
	Cgray: 10,
	LC_fair: 75,
	LC_unfair: 25,
	Blues: 3,
	contrastEL: 1.2,
	contrastTxt: 3,
	Cintense: 100,
	Cpastel: 70,
	HwidthDivRainbow: 90,
	HwidthDivSingle: 20,
	HwidthSeqRainbow: 180,
	HwidthSeqSingle: 15,
	Hspread: 90,
	// numbers of colors for which scores are computed (.C4A$nmin / .C4A$nmax)
	nmin: { cat: 1, seq: 2, cyc: 3, div: 3, bivs: 2, bivc: 2, bivd: 3, bivg: 2 },
	nmax: { cat: 36, seq: 15, cyc: 15, div: 15, bivs: 7, bivc: 10, bivd: 7, bivg: 7 },
	ndef: { cat: Infinity, seq: 7, cyc: 9, div: 9, bivs: 3, bivc: Infinity, bivd: 3, bivg: 3 },
	// number of rows with which bivariate palettes are scored (bivs: as many as columns)
	mScore: { bivc: 5, bivd: 5, bivg: 5 }
};

export const CUSTOM_TYPES = ["cat", "seq", "div", "cyc", "bivs", "bivc", "bivd", "bivg"];
export const isBivType = type => type.startsWith("biv");

const CVDS = ["deutan", "protan", "tritan"];
const min = a => Math.min(...a);
const max = a => Math.max(...a);
// R's min() without na.rm: NA if any value is NA
const minNA = a => (a.some(x => x === null || Number.isNaN(x)) ? null : min(a));

// ---------- color differences ----------

// spacesXYZ:::DeltaE.2000
function deltaE2000(l1, l2) {
	const Lbar = (l1[0] + l2[0]) / 2;
	let C1 = Math.hypot(l1[1], l1[2]), C2 = Math.hypot(l2[1], l2[2]);
	let Cbar = (C1 + C2) / 2;
	const g0 = Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7));
	const G = (1 - g0) / 2;
	const a1 = l1[1] * (1 + G), a2 = l2[1] * (1 + G);
	C1 = Math.hypot(a1, l1[2]);
	C2 = Math.hypot(a2, l2[2]);
	Cbar = (C1 + C2) / 2;
	const mod = (x, m) => ((x % m) + m) % m;
	const h1 = mod(Math.atan2(l1[2], a1), 2 * Math.PI), h2 = mod(Math.atan2(l2[2], a2), 2 * Math.PI);
	let Hbar = (h1 + h2) / 2;
	let hdelta = h2 - h1;
	if (Math.PI < Math.abs(h1 - h2)) {
		Hbar += Math.PI;
		hdelta -= Math.sign(hdelta) * 2 * Math.PI;
	}
	const rad = Math.PI / 180;
	const T = 1 - 0.17 * Math.cos(Hbar - 30 * rad) + 0.24 * Math.cos(2 * Hbar) + 0.32 * Math.cos(3 * Hbar + 6 * rad) - 0.2 * Math.cos(4 * Hbar - 63 * rad);
	const Ldelta = l2[0] - l1[0];
	const Cdelta = C2 - C1;
	const Hdelta = 2 * Math.sqrt(C1 * C2) * Math.sin(hdelta / 2);
	let SL = (Lbar - 50) ** 2;
	SL = 1 + 0.015 * SL / Math.sqrt(20 + SL);
	const SC = 1 + 0.045 * Cbar;
	const SH = 1 + 0.015 * Cbar * T;
	const thetaDelta = 30 * rad * Math.exp(-((((Hbar * 180 / Math.PI) - 275) / 25) ** 2));
	const RC = 2 * Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7));
	const RT = -RC * Math.sin(2 * thetaDelta);
	const Lt = Ldelta / SL, Ct = Cdelta / SC, Ht = Hdelta / SH;
	return Math.sqrt(Lt * Lt + Ct * Ct + Ht * Ht + RT * Ct * Ht);
}

// cols4all:::get_dist_matrix (colorblindcheck::palette_dist): CIEDE2000 of the
// simulated colors, upper triangle only (null elsewhere)
export function distMatrix(p, cvd) {
	const lab = simCVD(p, cvd).map(hexToLAB);
	return lab.map((a, i) => lab.map((b, j) => (j > i ? deltaE2000(a, b) : null)));
}

// ---------- palette properties ----------

// cols4all:::get_hue_width
function hueWidth(hs) {
	hs = hs.filter(h => h !== null);
	let w, hMax = 0;
	if (!hs.length) {
		w = 0;
	} else {
		const set = new Set([...hs, ...hs.map(h => h + 360)]);
		let gap = 0, gapMax = 0;
		for (let h = 0; h <= 720; h++) {
			gap = set.has(h) ? 0 : gap + 1;
			if (gap > gapMax) { gapMax = gap; hMax = h; }
		}
		w = roundR(360 - gapMax);
	}
	let HR = (hMax + w) % 360;
	const HL = (hMax + 1) % 360;
	if (HR < HL) HR += 360;
	let H = (HL + HR) / 2;
	if (H > 360) H -= 360;
	return { w, H };
}

// colorspace::contrast_ratio based: cols4all:::get_CRmin / get_CRbg
function crMin(p) {
	let m = Infinity;
	for (let i = 0; i < p.length - 1; i++) for (let j = i + 1; j < p.length; j++) m = Math.min(m, contrastRatio(p[i], p[j]));
	return m;
}
const crBg = (p, bg) => min(p.map(c => contrastRatio(c, bg)));

// cols4all:::hcl_prop (rounded as integers, as in R)
function hclProp(p) {
	const m = p.map(hexToHCL);
	const h = m.map(([H, C]) => (C <= C4A.Cgray ? null : roundR(H)));
	const n = p.length, isEven = n % 2 !== 1, nh = Math.floor(n / 2);
	const hL = h.slice(0, nh);
	const hR = h.slice(nh + (isEven ? 0 : 1));
	const Hw = hueWidth(h), HwL = hueWidth(hL), HwR = hueWidth(hR);
	const Ls = m.map(x => x[2]), Cs = m.map(x => x[1]);
	return {
		Cmax: roundR(max(Cs)),
		H: roundR(Hw.H),
		HL: roundR(HwL.H),
		HR: roundR(HwR.H),
		Lmid: roundR(isEven ? (m[nh - 1][2] + m[nh][2]) / 2 : m[nh][2]),
		Hwidth: Hw.w,
		HwidthL: HwL.w,
		HwidthR: HwR.w,
		Lrange: roundR(max(Ls) - min(Ls)),
		Crange: roundR(max(Cs) - min(Cs)),
		CRmin: roundR(crMin(p) * 100),
		CRwt: roundR(crBg(p, "#FFFFFF") * 100),
		CRbk: roundR(crBg(p, "#000000") * 100)
	};
}

// cols4all:::rgb_prop (approx_blues)
function rgbProp(p) {
	const blues = p.map(c => {
		let [r, g, b] = hexToRgb(c);
		if (r + g + b === 0) r = g = b = 1;
		return roundR(b / Math.max(r, g) * 100);
	});
	return { Blues: max(blues) };
}

// cols4all:::nameability
function nameability(p, nd) {
	const s = softmaxMatrix(namingMatrix(p, nd), nd.softmax.a, nd.softmax.th).map(r => r.map(x => (x > 0 ? 1 : 0)));
	const rowMax = max(s.map(r => r.reduce((a, b) => a + b, 0)));
	const colMax = max(s[0].map((_, j) => s.reduce((a, r) => a + r[j], 0)));
	return colMax <= 1 && rowMax <= 1 ? 1 : 0;
}

// ---------- check_<type>_pal ----------

// Distance-based scores (x 100, rounded, as stored in R)
function stepScores(m, n) {
	const steps = [], steps2 = [];
	for (let i = 0; i < n - 1; i++) steps.push(m[i][i + 1]);
	for (let i = 0; i < n - 2; i++) steps2.push(m[i][i + 2]);
	const tri = n > 2 ? min(steps2.flatMap((s2, i) => [s2 - steps[i], s2 - steps[i + 1]])) : 100;
	return { steps, tri };
}

function checkSeq(p) {
	const n = p.length;
	const sc = {};
	for (const cvd of CVDS) {
		const m = distMatrix(p, cvd);
		const { steps, tri } = stepScores(m, n);
		const all = m.flat().filter(x => x !== null);
		sc[cvd] = { min_step: roundR(min(steps) * 100), max_step: roundR(max(steps) * 100), min_dist: roundR(min(all) * 100), tri_ineq: roundR(tri * 100) };
	}
	const agg = (k, cvds) => min(cvds.map(c => sc[c][k]));
	const out = {};
	for (const k of ["min_step", "max_step", "min_dist", "tri_ineq"]) {
		out[k] = agg(k, CVDS);
		out[k + "_dp"] = agg(k, ["deutan", "protan"]);
	}
	return { ...out, ...hclProp(p), ...rgbProp(p) };
}

function checkCyc(p) {
	return checkSeq(p.slice(0, -1));
}

function checkDiv(p) {
	const n = p.length;
	const isEven = n % 2 !== 1;
	const nh = Math.floor(n / 2);
	const n2 = 50;
	// R: c(rampPal(p[1:(nh+1)], 25), rampPal(p[(nh + !is_even):n], 25))
	const p2 = [...rampPal(p.slice(0, nh + 1), n2 / 2), ...rampPal(p.slice(nh + (isEven ? 0 : 1) - 1), n2 / 2)];
	const nh1 = (n - (isEven ? 1 : 0)) / 2;
	const nh2 = nh1 + 1 + (isEven ? 1 : 0);
	const nh2b = Math.ceil(nh2);
	const scale = id => ((id - 1) / (n - 1)) * (n2 - 1) + 1;
	const nh1s = Math.floor(scale(nh1));
	const nh2bs = Math.ceil(scale(nh2b));

	const sc = {};
	for (const cvd of CVDS) {
		const dm2 = distMatrix(p2, cvd);
		const block = [];
		for (let i = 0; i < nh1s; i++) for (let j = nh2bs - 1; j < n2; j++) block.push(dm2[i][j]);
		const iwd = minNA(block);
		const dm = distMatrix(p, cvd);
		const { steps, tri } = stepScores(dm, n);
		sc[cvd] = { inter_wing_dist: iwd === null ? null : roundR(iwd * 100), min_step: roundR(min(steps) * 100), tri_ineq: roundR(tri * 100) };
	}
	const out = {};
	for (const k of ["inter_wing_dist", "min_step", "tri_ineq"]) {
		out[k] = minNA(CVDS.map(c => sc[c][k]));
		out[k + "_dp"] = minNA(["deutan", "protan"].map(c => sc[c][k]));
	}
	return { ...out, ...hclProp(p), ...rgbProp(p) };
}

function checkCat(p, nd) {
	if (p.length === 1) return { min_dist_none: Infinity, min_dist_deutan: Infinity, min_dist_protan: Infinity, min_dist_tritan: Infinity };
	const md = cvd => roundR(min(probMatrix(p, { cvd }).flat().filter(x => x !== null)));
	return {
		min_dist_none: md("none"),
		min_dist_deutan: md("deutan"),
		min_dist_protan: md("protan"),
		min_dist_tritan: md("tritan"),
		nameability: nameability(p, nd),
		...hclProp(p),
		...rgbProp(p)
	};
}

// ---------- bivariate (p: array of rows) ----------

const col = (p, j) => p.map(r => r[j]);
const diagOf = p => p.map((r, i) => r[i]);
const colMajor = p => p[0].map((_, j) => col(p, j)).flat(); // R: as.vector(p)
const rev = a => a.slice().reverse();
const DIV_KEYS = ["inter_wing_dist", "min_step", "inter_wing_dist_dp", "min_step_dp"];
// R: pmin(...)[keys]
const pminKeys = (list, keys) => Object.fromEntries(keys.map(k => [k, minNA(list.map(x => x[k]))]));

function checkBivs(p) {
	const p1 = p[0], p2 = col(p, 0), pd = diagOf(p);
	const sc = pminKeys([
		checkDiv([...rev(p1.slice(1)), ...p2]),
		checkDiv([...rev(p1.slice(1)), ...pd]),
		checkDiv([...rev(p2.slice(1)), ...pd])
	], DIV_KEYS);
	// R: c(as.vector(p[lower.tri(p)]), p[1,1], as.vector(p[upper.tri(p)])) (column-major)
	const n = p.length, lower = [], upper = [];
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		if (i > j) lower.push(p[i][j]);
		else if (i < j) upper.push(p[i][j]);
	}
	return { ...sc, ...hclProp([...lower, p[0][0], ...upper]), ...rgbProp(p.flat()) };
}

function checkBivc(p, nd) {
	const sc = pminKeys(p.map(r => checkCat(r, nd)), ["min_dist_none", "min_dist_deutan", "min_dist_protan", "min_dist_tritan", "nameability"]);
	return { ...sc, ...hclProp(colMajor(p)), ...rgbProp(p.flat()) };
}

// R: c(rev(p[, 1]), p[1, round((ncol(p)+1)/2)], p[, ncol(p)])
const bivdHclCols = p => {
	const k = p[0].length;
	return [...rev(col(p, 0)), p[0][roundR((k + 1) / 2) - 1], ...col(p, k - 1)];
};

function checkBivd(p) {
	const k = p[0].length;
	const c1 = 0, c3 = k - 1, c2 = Math.trunc((1 + k) / 2) - 1; // R: p[, (1 + ncol) / 2] (truncated index)
	const W = "#FFFFFF";
	const sc = pminKeys([
		checkDiv([...rev(col(p, c1)), W, ...col(p, c2)]),
		checkDiv([...rev(col(p, c1)), W, ...col(p, c3)]),
		checkDiv([...rev(col(p, c2)), W, ...col(p, c3)])
	], DIV_KEYS);
	return { ...sc, ...hclProp(bivdHclCols(p)), ...rgbProp(p.flat()) };
}

function checkBivg(p) {
	const k = p[0].length;
	const sc = pminKeys([checkDiv([...rev(col(p, 0)), "#FFFFFF", ...col(p, k - 1)])], DIV_KEYS);
	return { ...sc, ...hclProp(bivdHclCols(p)), ...rgbProp(p.flat()) };
}

const CHECK = { cat: checkCat, seq: checkSeq, div: checkDiv, cyc: checkCyc, bivs: checkBivs, bivc: checkBivc, bivd: checkBivd, bivg: checkBivg };

// ---------- show_attach_scores ----------

const SCORE_X100 = ["min_dist", "min_step", "max_step", "inter_wing_dist", "tri_ineq", "CRmin", "CRwt", "CRbk", "Blues",
	"min_dist_dp", "min_step_dp", "max_step_dp", "inter_wing_dist_dp", "tri_ineq_dp"];

// columns of a table row (as exported by R/export_data.R)
const SCORE_COLS = ["min_dist", "min_step", "max_step", "inter_wing_dist", "tri_ineq",
	"min_dist_none", "min_dist_deutan", "min_dist_protan", "min_dist_tritan",
	"min_dist_overall", "min_dist_overall_dp",
	"nameability", "Cmax", "H", "HL", "HR", "Lmid", "Hwidth", "HwidthL", "HwidthR", "HwidthLR",
	"Hspread", "Lrange", "Crange", "fairness", "CRmin", "CRwt", "CRbk", "Blues",
	"cbfriendly", "cbf_none", "cbf_deutan", "cbf_protan", "cbf_tritan",
	"chroma", "fair", "hues", "equiluminance", "contrastWT", "contrastBK", "float", "nameable"];

const isNA = x => x === null || x === undefined || Number.isNaN(x);

// cols4all:::get_friendlyness
function friendlyness(s, type, includeTritan) {
	const v = k => (!includeTritan && (k + "_dp") in s ? s[k + "_dp"] : s[k]);
	const any = (...x) => x.some(isNA);
	let r;
	if (type === "cat" || type === "bivc") {
		const md = Math.min(s.min_dist_deutan, s.min_dist_protan, includeTritan ? s.min_dist_tritan : Infinity);
		if (isNA(md)) return 0;
		const vf = type === "cat" && md >= C4A.CBVF_th.cat.min_dist;
		r = md / 1000 + (vf ? 2 : md >= C4A.CBF_th[type].min_dist ? 1 : md <= C4A.CBU_th[type].min_dist ? -1 : 0);
	} else if (type === "seq" || type === "cyc") {
		const md = v("min_dist"), ti = v("tri_ineq");
		if (any(md, ti)) return 0;
		const f = C4A.CBF_th[type], u = C4A.CBU_th[type];
		const bad = type === "seq" ? md < u.min_dist : md <= u.min_dist;
		r = md / 1000 + (md >= f.min_dist && ti >= f.tri_ineq ? 1 : bad || ti < u.tri_ineq ? -1 : 0);
	} else if (type === "div") {
		const iwd = v("inter_wing_dist"), ms = v("min_step"), ti = v("tri_ineq");
		if (any(iwd, ms, ti)) return 0;
		const f = C4A.CBF_th.div, u = C4A.CBU_th.div;
		r = iwd / 1000 + ms / 1e6 + (iwd >= f.inter_wing_dist && ms >= f.min_step && ti >= f.tri_ineq ? 1
			: iwd < u.inter_wing_dist || ms < u.min_step || ti < u.tri_ineq ? -1 : 0);
	} else if (["bivs", "bivd", "bivg"].includes(type)) {
		const iwd = v("inter_wing_dist"), ms = v("min_step");
		if (any(iwd, ms)) return 0;
		const f = C4A.CBF_th[type], u = C4A.CBU_th[type];
		r = iwd / 1000 + ms / 1e6 + (iwd >= f.inter_wing_dist && ms >= f.min_step ? 1 : iwd < u.inter_wing_dist || ms < u.min_step ? -1 : 0);
	} else return 0;
	return r;
}

const classifyCat = x => (isNA(x) ? null : x >= C4A.CBVF_th.cat.min_dist ? 2 : x >= C4A.CBF_th.cat.min_dist ? 1 : x <= C4A.CBU_th.cat.min_dist ? -1 : 0);

// Scores of the palette colors p (n colors, default range; bivariate: a
// matrix, as rows) as shown in the table: the same fields as a row of
// data/<type>.json.
// ctx: { nd: naming.json, fp: hcl.json's fairness parameters }
export function scoreRow(p, type, n, ctx) {
	const raw = CHECK[type](p, ctx.nd);
	const s = {};
	for (const [k, v] of Object.entries(raw)) s[k] = SCORE_X100.includes(k) && !isNA(v) ? v / 100 : v;

	const row = {};
	for (const k of SCORE_COLS) row[k] = k in s ? s[k] : null;

	row.cbfriendly = friendlyness(s, type, true);
	const cbfDp = friendlyness(s, type, false);
	for (const c of ["none", "deutan", "protan", "tritan"]) row["cbf_" + c] = classifyCat(s["min_dist_" + c]);
	if (type === "cat" || type === "bivc") {
		row.min_dist_overall = Math.min(s.min_dist_deutan, s.min_dist_protan, s.min_dist_tritan);
		row.min_dist_overall_dp = Math.min(s.min_dist_deutan, s.min_dist_protan);
	}
	row.chroma = s.Cmax >= C4A.Cintense ? "H" : s.Cmax < C4A.Cpastel ? "L" : "M";
	row.Hspread = roundR(s.Hwidth / (360 - 360 / n) * 100);
	row.fairness = type === "cat" || type === "bivc" ? getFairness(s.Lrange, s.Crange, ctx.fp) : getFairness(0, s.Crange, ctx.fp);
	row.fair = row.fairness >= C4A.LC_fair ? "H" : row.fairness < C4A.LC_unfair ? "L" : "M";
	if (["div", "bivs", "bivd", "bivg"].includes(type)) {
		row.hues = s.HwidthL >= C4A.HwidthDivRainbow || s.HwidthR >= C4A.HwidthDivRainbow ? "RH"
			: s.HwidthL < C4A.HwidthDivSingle && s.HwidthR < C4A.HwidthDivSingle ? "SH" : "MH";
		row.HwidthLR = Math.max(s.HwidthL, s.HwidthR);
	} else if (type === "seq") {
		row.hues = s.Hwidth < C4A.HwidthSeqSingle ? "SH" : s.Hwidth < C4A.HwidthSeqRainbow ? "MH" : "RH";
	} else if (type === "cat") {
		row.hues = row.Hspread > C4A.Hspread ? "RH" : "NA";
	} else {
		delete row.hues;
	}
	if (!["div", "bivs", "bivd", "bivg"].includes(type)) delete row.HwidthLR;
	row.equiluminance = s.CRmin < C4A.contrastEL;
	row.contrastWT = s.CRwt < C4A.contrastTxt;
	row.contrastBK = s.CRbk < C4A.contrastTxt;
	row.float = s.Blues >= C4A.Blues;
	if (s.Hwidth >= 180) row.H = 360;
	row.nameable = type === "cat" || type === "bivc" ? !!s.nameability : null;
	row.cbfriendly_dp = cbfDp;
	return row;
}

// ---------- palettes entered by the user (cols4all::c4a_data) ----------

// cols4all:::range_seq / range_div / range_cyc: default range per number of colors
function rangeMatrix(type, k) {
	const rm = Array.from({ length: k }, () => [0, 1]);
	if (type === "seq") {
		const nmin = Math.min(3, k), nmax = Math.min(9, k), slope = 1 / 30;
		const ns = [];
		for (let i = nmax; i >= nmin; i--) ns.push(i); // rev(nmin:nmax)
		let lb = ns.map(x => slope * (x - nmin)), ub = ns.map(x => 1 - slope * (x - nmin));
		if (nmin > 1) {
			lb = [...Array(nmin - 1).fill(lb[0]), ...lb];
			ub = [...Array(nmin - 1).fill(ub[0]), ...ub];
			const v1 = (lb[0] + ub[0]) / 2;
			lb[0] = v1; ub[0] = v1;
		}
		for (let i = 0; i < nmax; i++) rm[i] = [lb[i], ub[i]];
	} else if (type === "div") {
		const nmin = 3, nmax = Math.min(11, k), slope = 1 / 20;
		const ns = [];
		for (let i = nmax; i >= nmin; i--) ns.push(i);
		let lb = ns.map(() => 0), ub = ns.map(x => 1 - slope * (x - nmin));
		lb = [...Array(nmin - 1).fill(lb[0]), ...lb];
		ub = [...Array(nmin - 1).fill(ub[0]), ...ub];
		lb[0] = 0; ub[0] = 0;
		for (let i = 0; i < nmax; i++) rm[i] = [lb[i], ub[i]];
	}
	return rm;
}

// cols4all:::aregreys / convert2grey
const areGreys = x => x.every(c => hexToHCL(c)[1] < 1);
const toGrey = c => {
	const v = Math.floor((hexToRgb(c).reduce((a, b) => a + b / 255, 0) / 3) * 255 + 0.5).toString(16).toUpperCase().padStart(2, "0");
	return "#" + v + v + v;
};

// R: round(seq(0, 100, length.out = k)) + 1, as 0-based indices
const rangeIds = k => (k === 1 ? [0] : Array.from({ length: k }, (_, i) => roundR(i === k - 1 ? 100 : i * (100 / (k - 1)))));

// cols4all:::get_pal_n for bivariate palettes: n columns, m rows (array of rows)
function bivColors(pal, n, m) {
	const P = pal.matrix, rows = P.length, cols = P[0].length;
	if (rows === m && cols === n) return P.map(r => r.slice());
	const idsN = rangeIds(n), idsM = rangeIds(m);
	let p2;
	if (pal.type !== "bivc") {
		p2 = P.map(r => { const ramp = rampPal(r, 101); return idsN.map(i => ramp[i]); });
	} else {
		p2 = P.map(r => r.slice(0, n));
	}
	const cs = p2[0].map((_, j) => { const ramp = rampPal(col(p2, j), 101); return idsM.map(i => ramp[i]); });
	const res = idsM.map((_, i) => cs.map(c => c[i]));
	// make sure grays are really gray (R: column indices like 2.5 are truncated)
	const diagP = P.slice(0, Math.min(rows, cols)).map((r, i) => r[i]);
	if (pal.type === "bivs" && n === m && areGreys(diagP)) {
		for (let i = 0; i < n; i++) res[i][i] = toGrey(res[i][i]);
	} else if (pal.type === "bivd" && areGreys(col(P, Math.trunc((cols + 1) / 2) - 1))) {
		const mid = Math.trunc((n + 1) / 2) - 1;
		for (const r of res) r[mid] = toGrey(r[mid]);
	}
	return res;
}

// cols4all:::get_pal_n (default range); bivariate: array of rows
export function customColors(pal, n, m = 1) {
	if (isBivType(pal.type)) return bivColors(pal, n, m);
	if (pal.type === "cat") return pal.colors.slice(0, n);
	const rng = pal.range[Math.min(n, pal.range.length) - 1];
	return palWithRange({ base: pal.colors, space: "rgb" }, pal.type, n, rng);
}

// grDevices::gray.colors(n, start, end) (gamma 2.2), via grDevices::gray()
function grayColors(n, start, end, gamma = 2.2) {
	const a = start ** gamma, b = end ** gamma;
	return Array.from({ length: n }, (_, i) => {
		const lev = (n === 1 ? a : a + (b - a) * i / (n - 1)) ** (1 / gamma);
		const v = Math.floor(255 * lev + 0.5).toString(16).toUpperCase().padStart(2, "0");
		return "#" + v + v + v;
	});
}

// cols4all:::process_palette: color for missing values (a gray that can be
// distinguished from the palette colors, also by color blind people)
function naColor(pal, type) {
	const L = pal.map(c => hexToHCL(c)[2] / 100);
	const top = max(L);
	let cand = [grayColors(10, top, 1), grayColors(10, top, 0)];
	if (top < 0.6) cand.reverse();
	if (type === "cat") cand = [cand[0]];
	cand = cand.flat();
	const pal2 = [...pal, ...cand], k = pal.length;
	const ms = ["protan", "deutan", "tritan"].map(cvd => {
		const m = distMatrix(pal2, cvd);
		return cand.map((_, j) => min(pal.map((_, i) => m[i][k + j])));
	});
	const scores = cand.map((_, j) => min(ms.map(m => m[j])));
	const i10 = scores.findIndex(s => s >= 10);
	return i10 >= 0 ? cand[i10] : cand[scores.indexOf(max(scores))];
}

// A palette entered by the user: { name, type, colors, ncol (bivariate) } -> palette info as in data/<type>.json
export function prepareCustom({ name, type, colors, ncol }) {
	let cols = colors.map(c => c.toUpperCase());
	if (isBivType(type)) {
		// biv.method = "byrow": rows of ncol colors
		const matrix = [];
		for (let i = 0; i < cols.length; i += ncol) matrix.push(cols.slice(i, i + ncol));
		return { name, type, colors: cols, ncol, matrix, na: "#FFFFFF", nmin: 1, nmax: type === "bivc" ? ncol : null,
			ndef: type === "bivc" ? ncol : C4A.ndef[type], mmin: 1, mmax: null };
	}
	if (type === "cyc" && cols[0] !== cols[cols.length - 1]) cols = [...cols, cols[0]];
	const pal = { name, type, colors: cols };
	if (type !== "cat") pal.range = rangeMatrix(type, cols.length);
	pal.na = naColor(cols, type);
	pal.nmin = 1;
	pal.nmax = type === "cat" ? cols.length : null;
	pal.ndef = type === "cat" ? cols.length : C4A.ndef[type];
	return pal;
}

// Table row of a custom palette for key: number of colors ("7"), or columns x rows ("3x3")
export function customRow(pal, key, ctx) {
	const type = pal.type;
	const [n, m] = String(key).split("x").map(Number);
	if (n < C4A.nmin[type] || (pal.nmax !== null && n > pal.nmax)) return null;
	if (isBivType(type)) {
		const p = bivColors(pal, n, m);
		// scored with a fixed number of rows (series_add_get_scores)
		const mS = type === "bivs" ? n : C4A.mScore[type];
		const row = scoreRow(mS === m ? p : bivColors(pal, n, mS), type, n, ctx);
		for (const [k, v] of Object.entries(row)) if (typeof v === "number" && !Number.isFinite(v)) row[k] = null;
		return { f: "custom." + pal.name, c: p.flat(), ...row };
	}
	const c = customColors(pal, n);
	// scores of larger palettes than nmax are those of nmax (show_attach_scores)
	const nScore = Math.min(n, C4A.nmax[type]);
	const row = scoreRow(nScore === n ? c : customColors(pal, nScore), type, n, ctx);
	// as exported from R: non-finite numbers (e.g. Blues of pure blue) as null
	for (const [k, v] of Object.entries(row)) if (typeof v === "number" && !Number.isFinite(v)) row[k] = null;
	return { f: "custom." + pal.name, c, ...row };
}
