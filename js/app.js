import { prepTable, renderTable, sortChoices, iconFor, ICON_VARS } from "./table.js";
import { simCVD } from "./colorops.js";
import { setupApplication, appDefaults } from "./tabs/application.js";
import { setupContrast, contrastDefaults } from "./tabs/contrast.js";
import { setupBlues, bluesDefaults } from "./tabs/blues.js";
import { setupHCL, hclDefaults } from "./tabs/hcl.js";
import { setupNaming, namingDefaults } from "./tabs/naming.js";
import { setupCVD, cvdDefaults } from "./tabs/cvd.js";
import { setupInfo } from "./info.js";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

// show errors (e.g. data that could not be loaded) instead of failing silently
window.addEventListener("unhandledrejection", e => {
	const t = document.querySelector("#toast");
	t.textContent = "Error: " + (e.reason?.message || e.reason);
	t.classList.add("show");
});

const cache = {};
async function loadJSON(name) {
	if (!cache[name]) {
		cache[name] = fetch(`data/${name}.json`).then(r => {
			if (!r.ok) throw new Error(`Could not load data/${name}.json`);
			return r.json();
		});
	}
	return cache[name];
}

const meta = await loadJSON("meta");
const allSeries = Object.keys(meta.series);

// Implemented tabs (the others show a placeholder)
const TABS = ["overview", "cvd", "hcl", "contrast", "blues", "naming", "app"];

// Settings of the Overview tab (same names as in c4a_gui)
const defaults = {
	type1: "cat",
	type2: "bivs",
	n: 7,
	nbiv: 3,
	mbiv: 3,
	na: false,
	continuous: false,
	sortcolor: "orig",
	hstart: 0,
	auto_range: "auto",
	range: [0, 1],
	coltemp: "6500",
	cvd: "none",
	sort: "name",
	sortRev: false,
	include_tritan: false,
	filters: [],
	series: [...allSeries],
	textformat: "none",
	advanced: false,
	dark: false,
	search: ""
};
const state = structuredClone(defaults);
const appState = { ...appDefaults };
const contrastState = { ...contrastDefaults };
const bluesState = { ...bluesDefaults };
const hclState = { ...hclDefaults };
const namingState = { ...namingDefaults };
const cvdState = { ...cvdDefaults };
let tab = "overview";

// Selected palette, shared by all tabs except the Overview (tab_vals in c4a_gui)
const sel = { name: null, cols: [], type: null, na: false, pals: [] };

const type12 = () => (state.type1 === "biv" ? state.type2 : state.type1);
const isBiv = () => state.type1 === "biv";

// ---------- URL (shareable links) ----------
// Only settings that differ from their defaults are stored, e.g.
// ?type=seq&n=9&cvd=deutan&tab=app&pal=brewer.blues

const APP_KEYS = { cvd: "acvd", dotDist: "adot", dotSize: "adotsize", dotBorders: "adotborder", dotLwd: "adotlwd",
	lineStack: "astack", lineLwd: "alwd", mapDist: "amap", mapBorders: "amapborder", mapLwd: "amaplwd",
	txtSize: "afont", txtFace: "aface" };
const CONTRAST_KEYS = { sort: "csort", wcag: "cwcag", equi: "cequi", chart: "cchart", borders: "cborder", lwd: "clwd", plusOriginal: "corig" };
const BLUES_KEYS = { original: "borig", rev: "brev" };
const HCL_KEYS = { H: "hH", C: "hC", L: "hL", palcols: "hpal" };
const NAMING_KEYS = { a: "clarity" };
const CVD_KEYS = { mark: "dmark", lineSize: "dline", pointSize: "dpoint", numbers: "dnum", viewDist: "ddist", refLen: "druler" };

// tab -> [settings, defaults, URL keys]
const TAB_SETTINGS = {
	app: [appState, appDefaults, APP_KEYS],
	contrast: [contrastState, contrastDefaults, CONTRAST_KEYS],
	blues: [bluesState, bluesDefaults, BLUES_KEYS],
	hcl: [hclState, hclDefaults, HCL_KEYS],
	naming: [namingState, namingDefaults, NAMING_KEYS],
	cvd: [cvdState, cvdDefaults, CVD_KEYS]
};

// push: add a browser history entry (tab or palette chosen by the user), so
// that the back button returns to the previous view; otherwise replace it
function writeURL(push = false) {
	const p = new URLSearchParams();
	const t = type12();
	if (t !== "cat") p.set("type", t);
	if (isBiv()) {
		if (state.nbiv !== meta.ndef[t]) p.set("n", state.nbiv);
		if (state.mbiv !== (meta.mdef[t] ?? meta.ndef[t])) p.set("m", state.mbiv);
	} else if (state.n !== defaults.n) p.set("n", state.n);
	if (state.na) p.set("na", 1);
	if (state.continuous && ["seq", "div", "cyc"].includes(t)) p.set("cont", 1);
	if (state.sortcolor !== "orig") p.set("colorsort", state.sortcolor === "H" ? "H" + state.hstart : state.sortcolor);
	if (state.auto_range === "manual" && ["seq", "div"].includes(t)) p.set("range", state.range.join("-"));
	if (state.coltemp !== "6500") p.set("temp", state.coltemp);
	if (state.cvd !== "none") p.set("cvd", state.cvd);
	if (state.sort !== "name") p.set("sort", state.sort);
	if (state.sortRev) p.set("rev", 1);
	if (state.include_tritan) p.set("tritan", 1);
	if (state.filters.length) p.set("filters", state.filters.join(","));
	if (state.series.length !== allSeries.length) p.set("series", state.series.join(","));
	if (state.textformat !== "none") p.set("text", state.textformat);
	if (state.advanced) p.set("scores", 1);
	if (state.dark) p.set("dark", 1);
	if (state.search) p.set("q", state.search);
	if (tab !== "overview") {
		p.set("tab", tab);
		if (sel.name) p.set("pal", sel.name);
	}
	if (TAB_SETTINGS[tab]) {
		const [st, def, keys] = TAB_SETTINGS[tab];
		for (const [k, u] of Object.entries(keys)) {
			if (st[k] !== def[k]) p.set(u, typeof st[k] === "boolean" ? 1 : st[k]);
		}
	}
	const q = p.toString();
	const url = q ? "?" + q.replace(/%2C/g, ",") : location.pathname;
	if (push && url !== location.search + (location.search ? "" : location.pathname)) history.pushState(null, "", url);
	else history.replaceState(null, "", url);
}

let urlPal = null;
function readURL() {
	const p = new URLSearchParams(location.search);
	const num = (k, lo, hi) => {
		const v = parseFloat(p.get(k));
		return isFinite(v) && v >= lo && v <= hi ? v : null;
	};
	const t = p.get("type");
	if (t && Object.values(meta.types).includes(t)) {
		if (t.startsWith("biv")) { state.type1 = "biv"; state.type2 = t; } else state.type1 = t;
	}
	if (isBiv()) {
		const tt = type12();
		state.nbiv = num("n", 2, 10) ?? meta.ndef[tt];
		state.mbiv = num("m", 2, 7) ?? (meta.mdef[tt] ?? state.nbiv);
		if (tt === "bivs") state.mbiv = state.nbiv;
	} else if (p.has("n")) state.n = num("n", 1, 36) ?? defaults.n;
	state.na = p.has("na");
	state.continuous = p.has("cont");
	const cs = p.get("colorsort");
	if (cs) {
		if (cs[0] === "H") { state.sortcolor = "H"; state.hstart = Math.min(360, Math.max(0, parseInt(cs.slice(1), 10) || 0)); }
		else if (["C", "L"].includes(cs)) state.sortcolor = cs;
	}
	const rg = p.get("range");
	if (rg) {
		const [a, b] = rg.split("-").map(Number);
		if (a >= 0 && b <= 1 && a <= b) { state.auto_range = "manual"; state.range = [a, b]; }
	}
	if (["4000", "2700", "2200"].includes(p.get("temp"))) state.coltemp = p.get("temp");
	if (["bw", "deutan", "protan", "tritan"].includes(p.get("cvd"))) state.cvd = p.get("cvd");
	if (p.get("sort")) state.sort = p.get("sort");
	state.sortRev = p.has("rev");
	state.include_tritan = p.has("tritan");
	if (p.get("filters")) state.filters = p.get("filters").split(",").filter(f => f in meta.filter_labels);
	if (p.has("series")) state.series = (p.get("series") || "").split(",").filter(s => allSeries.includes(s));
	if (["hex", "RGB", "HCL"].includes(p.get("text"))) state.textformat = p.get("text");
	state.advanced = p.has("scores");
	state.dark = p.has("dark");
	state.search = (p.get("q") || "").slice(0, 100);
	if (TABS.includes(p.get("tab"))) tab = p.get("tab");
	urlPal = p.get("pal");
	for (const [st, def, keys] of Object.values(TAB_SETTINGS)) {
		for (const [k, u] of Object.entries(keys)) {
			if (!p.has(u)) continue;
			const d = def[k];
			st[k] = typeof d === "boolean" ? true : typeof d === "number" ? (parseFloat(p.get(u)) || d) : p.get(u);
		}
	}
}

// ---------- helpers ----------

function filterChoices(type) {
	const all = Object.entries(meta.filter_labels);
	return type === "cat" ? all : all.filter(([k]) => ["cbf", "fair", "crW", "crB"].includes(k));
}

// cols4all:::def_n(): slider range and value for cat/seq/div/cyc
function defN(npref, type, data) {
	const pals = Object.values(data.palettes).filter(p => state.series.includes(p.series));
	if (!pals.length) return null;
	let nmin = Math.min(...pals.map(p => p.nmin));
	let nmax = Math.max(...pals.map(p => (p.nmax === null ? Infinity : p.nmax)));
	if (npref === null || npref === undefined) npref = { cat: 7, seq: 7, div: 9 }[type] ?? 3;
	if (!isFinite(nmax)) nmax = 15;
	if (type === "div") { nmin = Math.max(nmin, 3); npref = Math.max(npref, 3); }
	else nmin = Math.max(nmin, 2);
	const n = (nmin <= npref && nmax >= npref) ? npref : nmax;
	return { n, nmin, nmax };
}

// ---------- build controls ----------

function radioGroup(el, name, choices, selected) {
	el.innerHTML = choices.map(([label, value]) =>
		`<label><input type="radio" name="${name}" value="${value}"${value === selected ? " checked" : ""}> ${label}</label>`).join("");
}

function buildFilters() {
	const choices = filterChoices(type12());
	state.filters = state.filters.filter(f => choices.some(([k]) => k === f));
	$("#filters").innerHTML = choices.map(([k, l]) =>
		`<label class="check"><input type="checkbox" value="${k}"${state.filters.includes(k) ? " checked" : ""}> ${l}</label>`).join("");
}

function buildSort() {
	const choices = sortChoices(type12(), state.advanced, meta.labels);
	if (!choices.some(([v]) => v === state.sort)) state.sort = "name";
	$("#sort").innerHTML = choices.map(([v, l]) => `<option value="${v}"${v === state.sort ? " selected" : ""}>${l}</option>`).join("");
}

function setSlider(id, { min, max, value, step = 1 }) {
	const el = $("#" + id);
	el.min = min; el.max = max; el.step = step; el.value = value;
	el.disabled = min === max;
	$(`#${id}-out`).textContent = value;
}

// keepBiv: keep the current numbers of columns/rows of bivariate palettes (initial load from URL)
async function updateSliders(keepBiv = false) {
	const type = type12();
	if (isBiv()) {
		const nmin = type === "bivd" ? 3 : 2, nmax = type === "bivc" ? 10 : 7, step = type === "bivd" ? 2 : 1;
		const ndef = meta.ndef[type], mdef = meta.mdef[type];
		if (!keepBiv) {
			state.nbiv = ndef;
			state.mbiv = mdef ?? ndef;
		}
		setSlider("nbiv", { min: nmin, max: nmax, value: state.nbiv, step });
		setSlider("mbiv", { min: nmin, max: 7, value: state.mbiv, step });
		$("#mbiv").disabled = mdef === null || mdef === undefined; // bivs: rows = columns
	} else {
		const data = await loadJSON(type);
		const ns = defN(state.n, type, data);
		if (!ns) return;
		state.n = ns.n;
		setSlider("n", { min: ns.nmin, max: ns.nmax, value: ns.n });
	}
}

function syncVisibility() {
	const type = type12();
	$("#type2-wrap").hidden = !isBiv();
	$("#n-wrap").hidden = isBiv();
	$("#biv-wrap").hidden = !isBiv();
	$("#continuous-wrap").hidden = !["seq", "div", "cyc"].includes(type);
	$("#sortcolor-cat").hidden = type !== "cat";
	$("#hstart-wrap").hidden = !(type === "cat" && state.sortcolor === "H");
	$("#sortcolor-seq").hidden = type !== "seq";
	$("#range-wrap").hidden = !["seq", "div"].includes(type);
	$("#range-manual").hidden = state.auto_range !== "manual";
	$("#range-left").textContent = type === "div" ? "Middle" : "Left";
	$("#range-right").textContent = type === "div" ? "Both sides" : "Right";
}

// state -> controls (initial load)
function syncControls() {
	const check = (name, value) => $$(`input[name="${name}"]`).forEach(x => (x.checked = x.value === String(value)));
	check("type1", state.type1);
	$("#type2").value = state.type2;
	for (const id of ["na", "continuous", "sortRev", "include_tritan", "advanced", "dark"]) $("#" + id).checked = state[id];
	check("sortcolor-cat", state.sortcolor);
	check("sortcolor-seq", state.sortcolor);
	$("#hstart").value = state.hstart;
	$("#hstart-out").textContent = state.hstart;
	check("auto_range", state.auto_range);
	$("#range0").value = state.range[0];
	$("#range1").value = state.range[1];
	updateRange();
	check("coltemp", state.coltemp);
	check("cvd", state.cvd);
	check("textformat", state.textformat);
	$$("#series input").forEach(x => (x.checked = state.series.includes(x.value)));
	setColtemp(state.coltemp);
	document.body.classList.toggle("dark", state.dark);
}

// The color sorting options are rebuilt per type (as in c4a_gui), so reset them
function resetSortcolor() {
	state.sortcolor = "orig";
	$$('input[name="sortcolor-cat"], input[name="sortcolor-seq"]').forEach(x => (x.checked = x.value === "orig"));
}

function colorsort() {
	const type = type12();
	if (!["cat", "seq"].includes(type) || state.sortcolor === "orig") return "orig";
	return state.sortcolor === "H" ? "H" + state.hstart : state.sortcolor;
}

// ---------- selected palette ----------

let current = null; // rows currently shown in the Overview table

// Set the selection from the rows of the Overview table (keep the selected palette if still available)
function updateSelection() {
	const rows = current || [];
	sel.pals = rows.map(r => r.f).sort((a, b) => a.localeCompare(b));
	let name = sel.name;
	if (urlPal && sel.pals.includes(urlPal)) { name = urlPal; urlPal = null; }
	if (!rows.some(r => r.f === name)) name = rows.length ? rows[0].f : null;
	selectPalette(name, false);
	$$(".pal-select").forEach(s => {
		s.innerHTML = sel.pals.map(p => `<option value="${p}">${p}</option>`).join("");
		s.value = sel.name || "";
		s.disabled = !sel.pals.length;
	});
}

function selectPalette(name, rerender = true, push = false) {
	const r = (current || []).find(x => x.f === name);
	sel.name = r ? r.f : null;
	// as c4a(pal_name, n, m): default range and color order
	sel.cols = r ? (state.na ? [...r.c0, r.na] : [...r.c0]) : [];
	sel.na = !!r && state.na;
	sel.type = type12();
	$$(".pal-select").forEach(s => (s.value = sel.name || ""));
	if (rerender) { renderTab(); writeURL(push); }
}

$$(".pal-select").forEach(s => s.addEventListener("change", () => selectPalette(s.value, true, true)));

// ---------- render ----------

async function render() {
	const type = type12();
	const data = await loadJSON(type);
	const s = {
		n: isBiv() ? state.nbiv : state.n,
		m: isBiv() ? state.mbiv : 1,
		na: state.na,
		continuous: !isBiv() && state.continuous,
		range: (["seq", "div"].includes(type) && state.auto_range === "manual") ? state.range : null,
		colorsort: colorsort(),
		cvd: state.cvd,
		coltemp: state.coltemp,
		sort: state.sort,
		sortRev: state.sortRev,
		series: state.series,
		filters: state.filters,
		include_tritan: state.include_tritan,
		show_scores: state.advanced,
		textformat: state.textformat,
		search: state.search
	};
	const wrap = $("#table-wrap");
	const p = state.series.length ? prepTable(data, s, meta) : null;
	if (!state.series.length) {
		wrap.innerHTML = `<div class="no-palettes"><b>No palette series selected.</b><ul><li>Select one or more palette series.</li></ul></div>`;
	} else if (!p) {
		wrap.innerHTML = state.search
			? `<div class="no-palettes"><b>No palettes found matching "${escHTML(state.search)}".</b><ul><li>Check the spelling, or change the palette type or other settings.</li></ul></div>`
			: `<div class="no-palettes"><b>No palettes found. Please change the selection.</b></div>`;
	} else {
		wrap.innerHTML = renderTable(p, s, meta);
	}
	current = p ? p.rows : null;
	lastSettings = s;
	updateSelection();
	updateSummary();
	if (tab !== "overview") renderTab();
	writeURL();
}

const escHTML = x => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let lastSettings = null; // settings used for the current table

// ---------- settings panel (collapsed on phones) ----------

// Short description of the settings that are hidden when the panel is collapsed
function updateSummary() {
	const parts = [];
	if (state.sort !== "name") parts.push("sorted by " + ($("#sort").selectedOptions[0]?.textContent || state.sort) + (state.sortRev ? ", reversed" : ""));
	else if (state.sortRev) parts.push("reversed");
	if (state.filters.length) parts.push(state.filters.length + (state.filters.length === 1 ? " filter" : " filters"));
	if (state.series.length !== allSeries.length) parts.push(`${state.series.length} of ${allSeries.length} series`);
	if (state.coltemp !== "6500") parts.push(state.coltemp + " K");
	if (colorsort() !== "orig") parts.push("colors sorted");
	if (state.na) parts.push("missing values");
	if (state.continuous && ["seq", "div", "cyc"].includes(type12())) parts.push("continuous");
	if (state.textformat !== "none") parts.push(state.textformat + " text");
	if (state.advanced) parts.push("scores");
	$("#settings-summary").textContent = parts.join(" · ");
}

function setSettingsOpen(open) {
	$("#controls").classList.toggle("collapsed", !open);
	const b = $("#settings-toggle");
	b.setAttribute("aria-expanded", open);
	b.querySelector(".st-label").textContent = open ? "Fewer settings" : "More settings";
}
$("#settings-toggle").addEventListener("click", () => {
	const open = $("#controls").classList.contains("collapsed");
	setSettingsOpen(open);
	if (!open) $("#controls").scrollIntoView({ block: "start" });
});

// ---------- search ----------

let searchTimer;
$("#search").addEventListener("input", e => {
	clearTimeout(searchTimer);
	searchTimer = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 150);
});

// ---------- tabs ----------

const appTab = setupApplication({
	state: appState,
	getSelection: () => sel,
	isDark: () => state.dark,
	loadJSON,
	changed: writeURL
});

const contrastTab = setupContrast({
	state: contrastState,
	getSelection: () => sel,
	isDark: () => state.dark,
	loadJSON,
	meta,
	changed: writeURL
});

const bluesTab = setupBlues({ state: bluesState, getSelection: () => sel, isDark: () => state.dark, meta, changed: writeURL });
const hclTab = setupHCL({ state: hclState, getSelection: () => sel, isDark: () => state.dark, loadJSON, changed: writeURL });

const namingTab = setupNaming({ state: namingState, getSelection: () => sel, isDark: () => state.dark, loadJSON, changed: writeURL });

const cvdTab = setupCVD({ state: cvdState, getSelection: () => sel, isDark: () => state.dark, loadJSON, meta, changed: writeURL });

const TAB_MODULES = { app: appTab, contrast: contrastTab, blues: bluesTab, hcl: hclTab, naming: namingTab, cvd: cvdTab };
setupInfo();

function renderTab() {
	TAB_MODULES[tab]?.render();
}

function showTab(name, push = false) {
	tab = name;
	$$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
	scrollTabIntoView();
	const panel = TABS.includes(name) ? "tab-" + name : "tab-placeholder";
	$$(".tab-panel").forEach(p => p.classList.toggle("active", p.id === panel));
	renderTab();
	writeURL(push);
}

// keep the active tab visible in the (horizontally scrolling) tab bar on phones
function scrollTabIntoView() {
	const nav = $(".tabs"), b = $(".tab.active");
	if (!b || nav.scrollWidth <= nav.clientWidth) return;
	const l = b.offsetLeft - nav.offsetLeft, r = l + b.offsetWidth;
	if (l < nav.scrollLeft) nav.scrollLeft = l - 16;
	else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = r - nav.clientWidth + 16;
}

$$(".tab").forEach(btn => btn.addEventListener("click", () => {
	if (btn.dataset.tab !== tab) showTab(btn.dataset.tab, true);
}));

// ---------- events ----------

$("#type1").addEventListener("change", async e => {
	state.type1 = e.target.value;
	resetSortcolor();
	syncVisibility();
	buildFilters();
	buildSort();
	await updateSliders();
	render();
});

$("#type2").addEventListener("change", async e => {
	state.type2 = e.target.value;
	syncVisibility();
	buildFilters();
	buildSort();
	await updateSliders();
	render();
});

for (const id of ["n", "nbiv", "mbiv"]) {
	$("#" + id).addEventListener("input", e => {
		state[id] = +e.target.value;
		$(`#${id}-out`).textContent = e.target.value;
		if (id === "nbiv" && type12() === "bivs") {
			state.mbiv = state.nbiv;
			setSlider("mbiv", { min: $("#mbiv").min, max: $("#mbiv").max, value: state.mbiv, step: $("#mbiv").step });
			$("#mbiv").disabled = true;
		}
		render();
	});
}

for (const id of ["na", "sortRev", "include_tritan", "continuous"]) {
	$("#" + id).addEventListener("change", e => { state[id] = e.target.checked; render(); });
}

$("#advanced").addEventListener("change", e => {
	state.advanced = e.target.checked;
	buildSort();
	render();
});

$("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });

$("#filters").addEventListener("change", () => {
	state.filters = $$("#filters input:checked").map(x => x.value);
	render();
});

$("#textformat").addEventListener("change", e => { state.textformat = e.target.value; render(); });

$("#sortcolor-cat").addEventListener("change", e => {
	if (e.target.name !== "sortcolor-cat") return;
	state.sortcolor = e.target.value;
	syncVisibility();
	render();
});
$("#sortcolor-seq").addEventListener("change", e => { state.sortcolor = e.target.value; render(); });
$("#hstart").addEventListener("input", e => {
	state.hstart = +e.target.value;
	$("#hstart-out").textContent = e.target.value;
	render();
});

$("#range-wrap").addEventListener("change", e => {
	if (e.target.name !== "auto_range") return;
	state.auto_range = e.target.value;
	syncVisibility();
	render();
});

// Two-handle range slider (two overlaid range inputs)
function updateRange(moved) {
	let a = +$("#range0").value, b = +$("#range1").value;
	if (a > b) {
		if (moved === "range0") { b = a; $("#range1").value = b; }
		else { a = b; $("#range0").value = a; }
	}
	state.range = [a, b];
	$("#range-out").textContent = a.toFixed(2) + " – " + b.toFixed(2);
}
for (const id of ["range0", "range1"]) {
	$("#" + id).addEventListener("input", () => { updateRange(id); render(); });
}

function setColtemp(t) {
	document.body.classList.remove("temp-6500", "temp-4000", "temp-2700", "temp-2200");
	document.body.classList.add("temp-" + t);
}
$("#coltemp").addEventListener("change", e => { state.coltemp = e.target.value; setColtemp(state.coltemp); render(); });
$("#cvd").addEventListener("change", e => { state.cvd = e.target.value; render(); });

$$(".info-btn").forEach(btn => btn.addEventListener("click", () => {
	const box = document.getElementById(btn.dataset.info);
	box.hidden = !box.hidden;
}));

let seriesTimer;
function seriesChanged() {
	state.series = $$("#series input:checked").map(x => x.value);
	clearTimeout(seriesTimer);
	seriesTimer = setTimeout(async () => {
		if (!isBiv()) await updateSliders();
		render();
	}, 300);
}
$("#series").addEventListener("change", seriesChanged);
$("#series-all").addEventListener("click", () => { $$("#series input").forEach(x => (x.checked = true)); seriesChanged(); });
$("#series-none").addEventListener("click", () => { $$("#series input").forEach(x => (x.checked = false)); seriesChanged(); });

$("#series-overview").addEventListener("click", () => {
	const o = meta.overview;
	const head = "<tr><th></th>" + o.types.map(t => `<th>${t}</th>`).join("") + "</tr>";
	const body = o.series.map((s, i) => "<tr><th>" + s + "</th>" +
		o.counts[i].map(c => `<td>${c || ""}</td>`).join("") + "</tr>").join("");
	const info = meta.type_info.map(t => `<tr><td>${t.type}</td><td>${t.description}</td></tr>`).join("");
	$("#overview-table").innerHTML = `<table class="simple">${head}${body}</table><table class="simple small">${info}</table>`;
	$("#overview-dialog").showModal();
});

$("#dark").addEventListener("change", e => {
	state.dark = e.target.checked;
	document.body.classList.toggle("dark", state.dark);
	renderTab();
	writeURL();
});

// Copy links in the table
function toast(msg) {
	const t = $("#toast");
	t.textContent = msg;
	t.classList.add("show");
	clearTimeout(t._timer);
	t._timer = setTimeout(() => t.classList.remove("show"), 1500);
}

async function copyText(r, what) {
	const cols = state.na ? [...r.c, r.na] : r.c;
	let txt;
	switch (what) {
		case "js": txt = "[" + cols.map(c => `"${c}"`).join(", ") + "]"; break;
		case "r": txt = "c(" + cols.map(c => `"${c}"`).join(", ") + ")"; break;
		default: {
			const refs = await loadJSON("refs");
			txt = refs[r.f]?.[a.dataset.copy] || "";
		}
	}
	try {
		await navigator.clipboard.writeText(txt);
		toast("Copied to clipboard");
	} catch {
		toast("Could not copy to clipboard");
	}
}

$("#table-wrap").addEventListener("click", e => {
	if (!current) return;
	const a = e.target.closest("a[data-copy]");
	if (a) {
		e.preventDefault();
		copyText(current[+a.dataset.i], a.dataset.copy);
		return;
	}
	const tr = e.target.closest("tbody tr[data-i]");
	// (not when the user is selecting text, e.g. a hex code)
	if (tr && !window.getSelection().toString()) showDetail(+tr.dataset.i);
});

// ---------- palette details ----------

const ANALYSIS_TABS = [["cvd", "Color Discrimination"], ["hcl", "HCL Analysis"], ["contrast", "Contrast"],
	["blues", "3D Blues"], ["naming", "Naming"], ["app", "Application"]];

function showDetail(i) {
	const r = current[i];
	if (!r) return;
	const s = lastSettings;
	const cols = state.na ? [...r.c, r.na] : [...r.c];
	const shown = simCVD(cols, s.cvd, s.coltemp);
	const swatches = cols.map((c, j) => `<div class="pd-sw"><span style="background:${shown[j]}"></span>` +
		`<code>${escHTML(c)}</code>${state.na && j === cols.length - 1 ? "<small>missing</small>" : ""}</div>`).join("");
	const items = detailScores(r, type12());
	const simulated = s.cvd !== "none" || s.coltemp !== "6500";
	$("#pal-detail").innerHTML = `
		<h3 id="pal-title"><span class="pd-series">${escHTML(r.series)}</span> ${escHTML(r.name)}</h3>
		<p class="pd-desc">${escHTML(meta.series[r.series] || "")}</p>
		<div class="pd-swatches">${swatches}</div>
		${simulated ? `<p class="hint">Colors are simulated (Color vision / Display temperature settings); the hex codes are the original colors.</p>` : ""}
		<h4>Analyze this palette</h4>
		<div class="pd-buttons">${ANALYSIS_TABS.map(([t, l]) => `<button type="button" data-tab="${t}">${l}</button>`).join("")}</div>
		<h4>Copy</h4>
		<div class="pd-buttons">
			<button type="button" data-copy="js" title='["#111111", "#222222"]'>Colors (JS / Python)</button>
			<button type="button" data-copy="r" title='c("#111111", "#222222")'>Colors (R)</button>
			<button type="button" data-copy="cit">Reference (APA)</button>
			<button type="button" data-copy="bib">BibTeX</button>
		</div>
		${items.length ? `<h4>Scores</h4><ul class="pd-scores">${items.join("")}</ul>` : ""}`;
	const dlg = $("#pal-dialog");
	dlg.dataset.i = i;
	dlg.showModal();
	dlg.scrollTop = 0;
}

// Score icons of a palette (those shown in the table), with their explanations (the table's tooltips)
function detailScores(r, type) {
	const shownCols = new Set($$("#table-wrap thead tr:last-child th.sc").map(th => th.dataset.q));
	const out = [];
	for (const q of ICON_VARS) {
		if (!shownCols.has(q)) continue;
		const ic = iconFor(meta, type, q, r[q]);
		if (!ic) continue;
		const label = (meta.labels[q] || q).replace(/&nbsp;/g, " ");
		out.push(`<li><span class="pd-icon"><span style="${escHTML(ic.css || "")}">${ic.html}</span></span>` +
			`<span><b>${escHTML(label)}</b>${ic.tooltip ? ": " + escHTML(ic.tooltip) : ""}</span></li>`);
	}
	return out;
}

$("#pal-dialog").addEventListener("click", e => {
	const dlg = $("#pal-dialog");
	if (e.target === dlg) { dlg.close(); return; } // click on the backdrop
	const r = current?.[+dlg.dataset.i];
	const b = e.target.closest("button[data-copy], button[data-tab]");
	if (!b || !r) return;
	if (b.dataset.copy) { copyText(r, b.dataset.copy); return; }
	dlg.close();
	selectPalette(r.f, false);
	showTab(b.dataset.tab, true);
	window.scrollTo({ top: 0 });
});

// ---------- back / forward buttons ----------

window.addEventListener("popstate", async () => {
	Object.assign(state, structuredClone(defaults));
	for (const [st, def] of Object.values(TAB_SETTINGS)) Object.assign(st, def);
	tab = "overview";
	readURL();
	restoreUI();
	await updateSliders(true);
	showTab(tab);
	await render();
});

$("#about-link").addEventListener("click", e => { e.preventDefault(); $("#about-dialog").showModal(); });
$("#version").textContent = `cols4all ${meta.version} (data exported ${meta.exported})`;

// ---------- init ----------

radioGroup($("#type1"), "type1", Object.entries(meta.types1), state.type1);
$("#type2").innerHTML = Object.entries(meta.types2.biv).map(([l, v]) => `<option value="${v}">${l}</option>`).join("");
$("#series").innerHTML = allSeries.map(s =>
	`<label class="check" title="${meta.series[s]}"><input type="checkbox" value="${s}" checked> ${s}</label>`).join("");

// state -> all controls (initial load and back/forward)
function restoreUI() {
	syncControls();
	Object.values(TAB_MODULES).forEach(m => m.sync());
	syncVisibility();
	buildFilters();
	buildSort();
	$("#search").value = state.search;
	$("#pal-dialog").open && $("#pal-dialog").close();
}

readURL();
restoreUI();
await updateSliders(true);
showTab(tab);
await render();
