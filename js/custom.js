// "Test your own palette": a dialog to enter palettes, which are then scored
// (js/score.js) and shown in the table as series "custom".
//
// Palettes are stored only in the URL of the page (parameter "my", one per
// palette: type.name.color1.color2..., bivariate: type.name.ncol.color1...),
// so nothing is uploaded and a palette
// can be shared by sharing the link.

import { CUSTOM_TYPES, isBivType } from "./score.js";

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const TYPE_LABELS = { cat: "Categorical", seq: "Sequential", div: "Diverging", cyc: "Cyclic",
	bivs: "Bivariate (sequential x sequential)", bivc: "Bivariate (sequential x categorical)",
	bivd: "Bivariate (sequential x diverging)", bivg: "Bivariate (sequential x desaturated)" };
const MAX_COLORS = 36;

// ---------- parsing colors ----------

let ctx2d = null;
// Any CSS color (hex, name, rgb(), hsl(), ...) -> "#RRGGBB", or null.
// The canvas ignores invalid colors: then the two probes give different results.
function cssToHex(token) {
	ctx2d ??= document.createElement("canvas").getContext("2d");
	const parse = probe => { ctx2d.fillStyle = probe; ctx2d.fillStyle = token; return ctx2d.fillStyle; };
	const v = parse("#000000");
	if (v !== parse("#ffffff")) return null;
	if (v.startsWith("#")) return v.toUpperCase();
	const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); // colors with transparency: ignore it
	return m ? "#" + m.slice(1, 4).map(x => (+x).toString(16).padStart(2, "0")).join("").toUpperCase() : null;
}

// R color names that are not CSS color names: grey0-100 / gray0-100
function rGray(token) {
	const m = token.match(/^gr[ae]y(\d{1,3})$/i);
	if (!m || +m[1] > 100) return null;
	const v = Math.floor(+m[1] * 2.55 + 0.5).toString(16).padStart(2, "0").toUpperCase(); // as in X11 / R
	return "#" + v + v + v;
}

// Text with colors (comma/space separated hex codes, an R vector c("#..", ..),
// a JSON/Python list, color names) -> { colors, invalid }
export function parseColors(text) {
	const tokens = text
		.replace(/\bc\s*\(/g, " ") // R: c(
		.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[0-9a-f]{6}\b|[a-z][a-z0-9]*/gi) || [];
	const colors = [], invalid = [];
	for (let t of tokens) {
		if (/^[0-9a-f]{6}$/i.test(t)) t = "#" + t;
		// #RRGGBBAA / #RGBA: ignore the transparency
		if (/^#[0-9a-f]{8}$/i.test(t)) t = t.slice(0, 7);
		if (/^#[0-9a-f]{4}$/i.test(t)) t = t.slice(0, 4);
		const hex = rGray(t) || cssToHex(t);
		if (hex) colors.push(hex); else invalid.push(t);
	}
	return { colors, invalid };
}

const cleanName = s => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

// ---------- URL ----------

export const toURL = p => [p.type, p.name, ...(isBivType(p.type) ? [p.ncol] : []), ...p.colors.map(c => c.slice(1))].join(".");

export function fromURL(s) {
	const [type, name, ...rest] = String(s).split(".");
	if (!CUSTOM_TYPES.includes(type) || !cleanName(name)) return null;
	const ncol = isBivType(type) ? parseInt(rest.shift(), 10) : undefined;
	const colors = rest.filter(c => /^[0-9a-f]{6}$/i.test(c)).map(c => "#" + c.toUpperCase()).slice(0, MAX_COLORS);
	const p = { type, name: cleanName(name), colors, ...(isBivType(type) ? { ncol } : {}) };
	return validate(p) ? null : p;
}

// error message, or null when the palette is fine
function validate({ type, colors, ncol }) {
	const k = colors.length;
	if (k > MAX_COLORS) return `At most ${MAX_COLORS} colors, please.`;
	if (isBivType(type)) {
		if (!(ncol >= 2)) return "A bivariate palette needs at least 2 columns.";
		if (k % ncol) return `${k} colors cannot be divided into rows of ${ncol} columns.`;
		if (k / ncol < 2) return "A bivariate palette needs at least 2 rows.";
		if (type === "bivd" && ncol < 3) return "A sequential x diverging palette needs at least 3 columns.";
		return null;
	}
	const minN = { cat: 2, seq: 2, div: 3, cyc: 3 }[type];
	if (k < minN) return `A ${TYPE_LABELS[type].toLowerCase()} palette needs at least ${minN} colors.`;
	return null;
}

// a sensible number of columns for k colors: as square as possible (at least as many columns as rows)
const guessNcol = k => {
	for (let c = Math.ceil(Math.sqrt(k)); c <= Math.min(k, 10); c++) if (k % c === 0) return c;
	return Math.max(2, Math.ceil(Math.sqrt(k)));
};

// ---------- dialog ----------

// ctx: { list(): input palettes, add(p), remove(name), select(name) }
export function setupCustom(ctx) {
	const dlg = $("#custom-dialog");
	const form = {
		colors: $("#cp-colors"), type: $("#cp-type"), name: $("#cp-name"), ncol: $("#cp-ncol"),
		preview: $("#cp-preview"), msg: $("#cp-msg"), add: $("#cp-add")
	};
	let parsed = { colors: [], invalid: [] };
	let ncolTouched = false;

	function check() {
		parsed = parseColors(form.colors.value);
		const n = parsed.colors.length;
		const biv = isBivType(form.type.value);
		$("#cp-ncol-wrap").hidden = !biv;
		if (biv && !ncolTouched && n) form.ncol.value = guessNcol(n);
		const ncol = parseInt(form.ncol.value, 10);
		form.preview.classList.toggle("grid", biv);
		form.preview.style.gridTemplateColumns = biv && ncol > 0 ? `repeat(${ncol}, 1fr)` : "";
		form.preview.innerHTML = parsed.colors.map(c => `<span style="background:${c}" title="${c}"></span>`).join("");
		const err = form.colors.value.trim() ? validate({ type: form.type.value, colors: parsed.colors, ncol }) : null;
		const parts = [];
		if (n) parts.push(`${n} color${n === 1 ? "" : "s"}`);
		if (parsed.invalid.length) parts.push(`not recognized: ${parsed.invalid.map(esc).join(", ")}`);
		if (err) parts.push(err);
		form.msg.innerHTML = parts.join(" · ");
		form.msg.classList.toggle("error", !!(err || parsed.invalid.length));
		form.add.disabled = !n || !!err;
		const exists = ctx.list().some(p => p.name === cleanName(form.name.value || "my_palette"));
		form.add.textContent = exists ? "Update palette" : "Add to table";
	}

	function renderList() {
		const pals = ctx.list();
		$("#cp-list-wrap").hidden = !pals.length;
		$("#cp-list").innerHTML = pals.map(p => `<li>
			<span class="cp-strip${isBivType(p.type) ? " grid" : ""}" style="${isBivType(p.type) ? `grid-template-columns: repeat(${p.ncol}, 1fr)` : ""}">${p.colors.map(c => `<span style="background:${c}"></span>`).join("")}</span>
			<span class="cp-name"><b>${esc(p.name)}</b> <span class="muted">${TYPE_LABELS[p.type]}, ${isBivType(p.type) ? `${p.colors.length / p.ncol} x ${p.ncol}` : p.colors.length} colors</span></span>
			<span class="cp-btns">
				<button type="button" data-act="show" data-name="${esc(p.name)}">Show</button>
				<button type="button" data-act="edit" data-name="${esc(p.name)}">Edit</button>
				<button type="button" data-act="remove" data-name="${esc(p.name)}" aria-label="Remove ${esc(p.name)}">Remove</button>
			</span>
		</li>`).join("");
	}

	function load(p) {
		form.colors.value = p ? p.colors.join(", ") : "";
		form.type.value = p ? p.type : form.type.value;
		form.name.value = p ? p.name : "";
		ncolTouched = !!(p && p.ncol);
		if (p && p.ncol) form.ncol.value = p.ncol;
		check();
	}

	function open(name = null) {
		renderList();
		load(ctx.list().find(p => p.name === name) || null);
		dlg.showModal();
		if (!name) form.colors.focus();
	}

	form.colors.addEventListener("input", check);
	form.type.addEventListener("change", check);
	form.name.addEventListener("input", check);
	form.ncol.addEventListener("input", () => { ncolTouched = true; check(); });
	form.add.addEventListener("click", () => {
		if (form.add.disabled) return;
		const taken = new Set(ctx.list().map(p => p.name));
		let name = cleanName(form.name.value);
		if (!name) { name = "my_palette"; for (let i = 2; taken.has(name); i++) name = "my_palette" + i; }
		dlg.close();
		const type = form.type.value;
		ctx.add({ type, name, colors: parsed.colors, ...(isBivType(type) ? { ncol: parseInt(form.ncol.value, 10) } : {}) });
	});
	$("#cp-list").addEventListener("click", e => {
		const b = e.target.closest("button[data-act]");
		if (!b) return;
		const name = b.dataset.name;
		if (b.dataset.act === "edit") load(ctx.list().find(p => p.name === name));
		else if (b.dataset.act === "remove") { ctx.remove(name); renderList(); check(); }
		else { dlg.close(); ctx.select(name); }
	});
	// examples: one per type group, cycling
	const EXAMPLES = [
		{ type: "cat", name: "okabe_ito", colors: `c("#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7")` },
		{ type: "seq", name: "sunset", colors: "#FFFFCC, #FED976, #FD8D3C, #E31A1C, #800026" },
		{ type: "div", name: "purple_green", colors: "#762A83, #C2A5CF, #F7F7F7, #A6DBA0, #1B7837" },
		{ type: "bivs", name: "stevens_pink_blue", ncol: 3, colors: "#E8E8E8, #ACE4E4, #5AC8C8,\n#DFB0D6, #A5ADD3, #5698B9,\n#BE64AC, #8C62AA, #3B4994" }
	];
	let ex = 0;
	$("#cp-example").addEventListener("click", () => {
		const e = EXAMPLES[ex++ % EXAMPLES.length];
		form.colors.value = e.colors;
		form.type.value = e.type;
		form.name.value = e.name;
		ncolTouched = !!e.ncol;
		if (e.ncol) form.ncol.value = e.ncol;
		check();
	});
	dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

	return { open };
}
