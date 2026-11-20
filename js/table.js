// Overview table: port of cols4all:::table_columns(), prep_table() and plot_table()

import { isLight, rgbTriple, hclTriple } from "./color.js";
import { simCVD, palWithRange, sortColors } from "./colorops.js";

const isBiv = type => type.startsWith("biv");

// cols4all:::table_columns()
// qn: displayed columns, qs: the column used to sort on each of them,
// sn: extra sort-only columns
export function tableColumns(type, show) {
	const S = arr => (show ? arr : []);
	let qn = [], qs = [];
	if (!["seq", "div", "cyc", "bivs", "bivd", "bivg"].includes(type)) {
		qn.push("nmax"); qs.push("nmax");
	}
	const add = (n, s = n) => { qn.push(n); qs.push(s); };
	const addAll = arr => arr.forEach(x => add(x));

	if (type === "cat") {
		add("cbf_none"); addAll(S(["min_dist_none"]));
		add("cbf_deutan"); addAll(S(["min_dist_deutan"]));
		add("cbf_protan"); addAll(S(["min_dist_protan"]));
		add("cbf_tritan"); addAll(S(["min_dist_tritan"]));
		addAll(S(["min_dist_overall", "min_dist_overall_dp"]));
	} else if (type === "bivc") {
		add("cbfriendly");
		addAll(S(["min_dist_none", "min_dist_deutan", "min_dist_protan", "min_dist_tritan", "min_dist_overall", "min_dist_overall_dp"]));
	} else {
		add("cbfriendly");
		const pair = { seq: ["min_dist", "tri_ineq"], cyc: ["min_dist", "tri_ineq"],
			div: ["inter_wing_dist", "min_step", "tri_ineq"],
			bivs: ["inter_wing_dist", "min_step"], bivd: ["inter_wing_dist", "min_step"], bivg: ["inter_wing_dist", "min_step"] }[type] || [];
		addAll(S(pair));
	}

	add("fair"); addAll(S(["fairness"]));

	const hasHues = ["seq", "div", "cat", "bivs", "bivd", "bivg"].includes(type);
	const hasEqui = ["cat", "bivc"].includes(type);
	const hasName = ["cat", "bivc"].includes(type);
	const huesQs = { cat: "Hspread", seq: "Hwidth" }[type] || "HwidthLR";
	const hueRaw = ["H", "HL", "HR", "Hwidth", "Hspread", "HwidthL", "HwidthR"];

	if (hasHues) { add("hues", huesQs); addAll(S(hueRaw)); }
	add("chroma", "Cmax"); addAll(S(["Cmax", "Crange"]));
	add("contrastWT", "CRwt"); addAll(S(["CRwt"]));
	add("contrastBK", "CRbk"); addAll(S(["CRbk"]));
	if (hasEqui) { add("equiluminance", "CRmin"); addAll(S(["CRmin"])); }
	add("float", "Blues"); addAll(S(["Blues"]));
	if (hasName) add("nameable", "nameability");
	if (show) {
		if (!hasHues) addAll(hueRaw);
		addAll(["Lmid", "Lrange"]);
	}

	const sn = { seq: ["H"], div: ["HL", "HR", "Lmid"], bivs: ["HL", "HR", "Lmid"], bivd: ["HL", "HR", "Lmid"], bivg: ["HL", "HR", "Lmid"] }[type] || [];

	const qnSort = [...qn], qsSort = [...qs];
	if (type === "cat" || type === "bivc") {
		for (const x of ["min_dist_overall", "min_dist_overall_dp"]) {
			if (!qn.includes(x)) { qnSort.push(x); qsSort.push(x); }
		}
	}
	return { qn, qs, sn, qnSort, qsSort };
}

// Sort options (as in c4a_gui's get_cols()): [value, label]
export function sortChoices(type, show, labels) {
	const res = tableColumns(type, show);
	const strip = s => (s || "").replace(/&nbsp;/g, "");
	const xn = [...res.qn, ...res.sn];
	const xl = [...res.qn.map(q => strip(labels[q])), ...res.sn.map(s => labels[s])];
	for (const x of res.qnSort.filter(q => !res.qn.includes(q))) {
		xn.push(x); xl.push(strip(labels[x]));
	}
	const seen = new Set();
	const out = [["name", "Name"]];
	xn.forEach((v, i) => {
		if (seen.has(xl[i])) return;
		seen.add(xl[i]);
		out.push([v, xl[i]]);
	});
	return out;
}

// cols4all:::pass_filters()
function passFilters(r, filters, includeTritan) {
	return filters.every(f => {
		switch (f) {
			case "cbf": return (includeTritan ? r.cbfriendly : r.cbfriendly_dp) >= 1;
			case "fair": return r.fair === "H";
			case "naming": return r.nameable === true;
			case "crW": return r.contrastWT === false;
			case "crB": return r.contrastBK === false;
			default: return true;
		}
	});
}

// R's order(): NA last, stable
function compare(a, b) {
	const na = a === null || a === undefined, nb = b === null || b === undefined;
	if (na || nb) return na === nb ? 0 : (na ? 1 : -1);
	if (typeof a === "string") return a.localeCompare(b);
	return a < b ? -1 : a > b ? 1 : 0;
}

// cols4all:::prep_table()
// data: <type>.json, s: settings
export function prepTable(data, s, meta) {
	const type = data.type;
	const key = isBiv(type) ? `${s.n}x${s.m}` : String(s.n);
	let rows = data.rows[key];
	if (!rows) return null;

	const pals = data.palettes;
	const series = new Set(s.series);
	const nOnly = s.filters.includes("nmax");
	// search: all words must occur in "series.name" (case-insensitive)
	const words = (s.search || "").toLowerCase().split(/\s+/).filter(Boolean);
	const filters = s.filters.filter(f => f !== "nmax");

	rows = rows.filter(r => {
		const p = pals[r.f];
		if (!series.has(p.series)) return false;
		if (nOnly && p.nmax !== s.n) return false;
		if (words.length && !words.every(w => r.f.toLowerCase().includes(w))) return false;
		return passFilters(r, filters, s.include_tritan);
	}).map(r => {
		const p = pals[r.f];
		const x = { ...r, c0: r.c, name: p.name, series: p.series, na: p.na, nmax: p.nmax };
		// manual range (seq/div) and color sorting (cat/seq), see get_pal_n()
		if (s.range && p.base) x.c = palWithRange(p, type, s.n, s.range);
		if (s.colorsort && s.colorsort !== "orig") x.c = sortColors(x.c, type, s.colorsort);
		// cbfriendly classification depends on whether tritan is included
		if (!s.include_tritan && r.cbfriendly_dp !== undefined) x.cbfriendly = r.cbfriendly_dp;
		return x;
	});
	if (!rows.length) return null;

	const cols = tableColumns(type, s.show_scores);
	let sort = s.sort, isRev = s.sortRev;
	let sortCol;
	if (sort === "name") sortCol = "f";
	else if (["H", "HL", "HR", "Lmid"].includes(sort)) sortCol = sort;
	else {
		const i = cols.qnSort.indexOf(sort);
		sortCol = i >= 0 ? cols.qsSort[i] : "f";
	}
	const decreasing = isRev !== meta.sortRev.includes(sortCol);
	rows.sort((a, b) => {
		const va = a[sortCol], vb = b[sortCol];
		const naA = va === null || va === undefined, naB = vb === null || vb === undefined;
		if (naA || naB) return compare(va, vb);
		return decreasing ? compare(vb, va) : compare(va, vb);
	});

	const maxN = Math.max(...rows.map(r => r.c.length));
	const continuous = !!s.continuous && ["seq", "div", "cyc"].includes(type);
	const columns = continuous ? s.n : Math.min(isBiv(type) ? s.n : (s.n > 16 ? 12 : s.n), maxN);
	return { type, rows, qn: cols.qn, columns, continuous };
}

// Icon columns: variable -> key in meta.icons
export const ICON_VARS = ["cbfriendly", "cbf_none", "cbf_deutan", "cbf_protan", "cbf_tritan", "chroma", "hues", "fair",
	"nameable", "equiluminance", "contrastWT", "contrastBK", "float"];
const BIG_ICONS = ["cbfriendly", "cbf_none", "cbf_deutan", "cbf_protan", "cbf_tritan", "chroma", "fair"];

export function iconFor(meta, type, v, value) {
	let set = meta.icons[v.startsWith("cbf_") ? "cbf_cvd" : v];
	if (!set) return null;
	if (["seq", "cat", "div", "cyc"].some(t => t in set)) set = set[type] || set.x;
	let k;
	if (value === null || value === undefined) k = "NA";
	else if (typeof value === "boolean") k = value ? "TRUE" : "FALSE";
	else if (v === "cbfriendly" || v.startsWith("cbf_")) k = String(Math.round(value));
	else k = String(value);
	return set[k] || null;
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function headerCell(meta, key, fallback, cls = "") {
	const c = cls ? ` class="${cls}"` : "";
	const dq = cls === "sc" ? ` data-q="${key}"` : "";
	const h = meta.headers[key];
	if (!h) return `<th${c}${dq}>${fallback ?? ""}</th>`;
	const style = h.css ? ` style="${esc(h.css)}"` : "";
	const title = h.tooltip ? ` title="${esc(h.tooltip)}"` : "";
	return `<th${c}${dq}${title}${style}>${h.html.replace(/\n/g, "<br>")}</th>`;
}

// Group header spans above the score columns (see plot_table())
function groupSpans(cols, type) {
	const idx = c => cols.indexOf(c);
	const nextBoundary = (from, cands) => {
		const pos = cands.map(idx).filter(p => p > from);
		return pos.length ? Math.min(...pos) - 1 : cols.length - 1;
	};
	const spans = [];
	const cbfFirst = ["cbf_none", "cbfriendly"].find(c => cols.includes(c));
	if (cbfFirst) spans.push({ first: idx(cbfFirst), last: nextBoundary(idx(cbfFirst), ["fair"]),
		label: (type === "cat" || type === "bivc") ? "Separability" : "Colorblind-friendly" });
	const hueFirst = ["hues", "H"].find(c => cols.includes(c));
	if (hueFirst) spans.push({ first: idx(hueFirst), last: nextBoundary(idx(hueFirst), ["chroma", "Lmid"]), label: "Hue" });
	spans.push({ first: idx("chroma"), last: nextBoundary(idx("chroma"), ["contrastWT"]), label: "Chroma" });
	spans.push({ first: idx("contrastWT"), last: nextBoundary(idx("contrastWT"), ["float"]), label: "Contrast Ratio" });
	if (cols.includes("Lmid")) spans.push({ first: idx("Lmid"), last: idx("Lrange"), label: "Luminance" });
	return spans.sort((a, b) => a.first - b.first);
}

// cols4all:::plot_table()
// p: prepTable() output, s: settings
export function renderTable(p, s, meta) {
	const { type, rows, qn, continuous } = p;
	const columns = continuous ? 1 : p.columns;
	const tot = Math.ceil(Math.max(...rows.map(r => r.c.length), columns) / columns) * columns;
	const textFormat = s.textformat;
	const sim = cols => simCVD(cols, s.cvd || "none", s.coltemp || "6500");

	// col: original color (text), shown: simulated color (background)
	const colorCell = (col, shown, cls = "col") => {
		if (!col) return `<td class="${cls}"></td>`;
		let txt = col, fg = shown;
		if (textFormat !== "none") {
			fg = isLight(shown) ? "#000000" : "#FFFFFF";
			txt = textFormat === "RGB" ? rgbTriple(col) : textFormat === "HCL" ? hclTriple(col) : col;
		}
		const small = textFormat === "RGB" ? " small" : "";
		return `<td class="${cls}"><span class="swatch${small}" style="background:${shown};color:${fg}" title="${col}">${txt}</span></td>`;
	};
	const gradientCell = cols => `<td class="col ramp" style="min-width:${6 * p.columns}em"><span class="swatch" style="background:linear-gradient(to right, ${cols.join(", ")})"></span></td>`;

	// Header rows
	const allCols = ["series", "label", ...qn];
	const scoreStart = 2;
	const spans = groupSpans(qn, type);
	let g = "<tr class=\"groups\">";
	let pos = 0;
	for (const sp of spans) {
		const first = sp.first + scoreStart, n = sp.last - sp.first + 1;
		if (first > pos) g += `<th colspan="${first - pos}" class="blank"></th>`;
		g += `<th colspan="${n}" class="group">${sp.label}</th>`;
		pos = first + n;
	}
	const totalCols = allCols.length + columns + (s.na ? 2 : 0) + 4;
	if (totalCols > pos) g += `<th colspan="${totalCols - pos}" class="blank"></th>`;
	g += "</tr>";

	let h = "<tr>" + headerCell(meta, "series", "", "series") + headerCell(meta, "name", "", "name");
	for (const q of qn) h += headerCell(meta, q, (meta.labels[q] || q).replace(/&nbsp;/g, ""), "sc");
	if (continuous) h += `<th></th>`;
	else for (let i = 1; i <= columns; i++) h += `<th class="colnum">${i}</th>`;
	if (s.na) h += `<th class="spacer"></th><th class="colnum">Missings</th>`;
	h += `<th colspan="4" class="copy" title="${esc(meta.headers.references?.tooltip || "")}">References</th></tr>`;

	// Body
	let b = "";
	rows.forEach((r, i) => {
		const nlines = continuous ? 1 : Math.floor((r.c.length - 1) / columns) + 1;
		const shown = sim(r.c);
		const padded = r.c.concat(Array(Math.max(0, tot - r.c.length)).fill(""));
		const paddedShown = shown.concat(Array(Math.max(0, tot - r.c.length)).fill(""));
		for (let line = 0; line < nlines; line++) {
			const first = line === 0, last = line === nlines - 1;
			b += `<tr class="${first ? "first" : "cont"}${last ? " last" : ""}" data-i="${i}">`;
			if (first) {
				const des = meta.series[r.series] || "";
				b += `<td class="series" title="${esc(des)}">${esc(r.series)}</td><td class="name"><span class="mser">${esc(r.series)}</span>${esc(r.name)}</td>`;
				for (const q of qn) {
					if (ICON_VARS.includes(q)) {
						const ic = iconFor(meta, type, q, r[q]);
						const cls = BIG_ICONS.includes(q) ? "sc icon big" : "sc icon";
						b += ic ? `<td class="${cls}" title="${esc(ic.tooltip || "")}"><span style="${esc(ic.css || "")}">${ic.html}</span></td>` : `<td class="${cls}"></td>`;
					} else {
						const v = r[q];
						b += `<td class="sc num">${v === null || v === undefined ? "" : esc(v)}</td>`;
					}
				}
			} else {
				b += `<td class="series"></td><td class="name"></td>` + qn.map(() => `<td class="sc"></td>`).join("");
			}
			if (continuous) b += gradientCell(shown);
			else for (let j = 0; j < columns; j++) b += colorCell(padded[line * columns + j], paddedShown[line * columns + j]);
			if (s.na) b += `<td class="spacer"></td>` + (first ? colorCell(r.na, sim([r.na])[0]) : "<td></td>");
			if (first) {
				b += `<td class="copy"><a href="#" data-copy="cit" data-i="${i}" title="Copy reference (APA style)">&#128214;</a></td>`
					+ `<td class="copy"><a href="#" data-copy="bib" data-i="${i}" title="Copy BibTeX reference">Bib</a></td>`
					+ `<td class="copy"><a href="#" data-copy="js" data-i="${i}" title='Copy colors to standard format (e.g. used by JavaScript and Python): ["#111111", "#222222"]'>JS</a></td>`
					+ `<td class="copy"><a href="#" data-copy="r" data-i="${i}" title='Copy colors to R: c("#111111", "#222222")'>R</a></td>`;
			} else {
				b += `<td class="copy"></td>`.repeat(4);
			}
			b += "</tr>";
		}
	});

	return `<table class="c4a-table"><thead>${g}${h}</thead><tbody>${b}</tbody></table>`;
}
