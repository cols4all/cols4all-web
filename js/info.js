// Explanations of the analysis plots: a button (ⓘ) next to a plot title starts
// a short step-by-step tour. Each step dims the plot except the parts it is
// about, and explains them in a card below the plot.
//
// Step targets are rectangles in plot coordinates (fractions of the plot's
// width and height: [x, y, w, h]), or a CSS selector of an element inside the
// plot (e.g. the selected cell of a matrix, which moves when the user clicks).

const ALL = [0, 0, 1, 1];

// Similarity / contrast matrices (layout of matrixSVG(): colors on top and left)
const MAT = {
	rows: [0.065, 0.155, 0.09, 0.79],
	cols: [0.15, 0.045, 0.6, 0.095],
	legend: [0.78, 0.04, 0.2, 0.26],
	sel: "circle[stroke-dasharray]"
};

// Confusion-line plots (confusionSVG(): the sRGB gamut triangle)
const TRIANGLE = [0.06, 0.03, 0.89, 0.95];

const separability = who => [
	{ target: [MAT.rows, MAT.cols], text: "Each cell compares two palette colors: <b>color 1</b> (its row) and <b>color 2</b> (its column)." },
	{ target: MAT.sel, text: `How many ${who} can tell these two colors apart? Click a cell, or a color in the row or column, to select another pair. The example lines or points on the right use this pair.` },
	{ target: MAT.legend, text: "A symbol means the two colors are hard to tell apart: the bigger the symbol, the harder. No symbol: at least 99% can tell them apart." },
	{ target: ALL, text: "This is based on the model of Szafir (2018), for lines or points of the chosen size (see Size and Calibration above)." }
];

const confusion = (name, who) => [
	{ target: TRIANGLE, text: `The same color space, but as perceived by ${who} (<b>${name}</b>).` },
	{ target: ALL, text: "These lines are <b>confusion lines</b>: colors along the same line may be hard to tell apart. Palette colors (1, 2, 3, …) on or near the same line are a warning sign." }
];

// key -> list of [plot element, steps]
const TOURS = {
	simu: [["#cvd-strip", [
		{ target: [0.053, 0.11, 0.947, 0.2], text: "The top row shows the palette colors, as seen with normal color vision." },
		{ target: [0, 0.33, 0.055, 0.67], text: "The other rows are the three types of color blindness: deutan and protan (both red-green) and tritan (blue-yellow)." },
		{ target: [0.053, 0.33, 0.947, 0.67], text: "These rows show how people with these types of color blindness perceive the palette. Colors that look alike in a row are hard to tell apart for them." }
	]]],
	hue_lines: [["#cvd-cl-none", [
		{ target: TRIANGLE, text: "The triangle is the color space: all colors a typical screen can show (sRGB), in the CIE chromaticity diagram. Brightness is left out." },
		{ target: [0.3, 0.06, 0.3, 0.48], text: "The lines start at the white point (+). Colors along each line have the same <b>hue</b>; the further from the white point, the more saturated." },
		{ target: TRIANGLE, text: "The numbers 1, 2, 3, … are the palette colors. They may look brighter here than in the palette, because brightness is not shown." },
		{ target: ALL, text: "Below, the same plot shows how people with color blindness perceive these colors." }
	]]],
	simi: [["#cvd-mat-none", separability("people")]],
	conf: [
		["#cvd-cl-deutan", confusion("deutans", "people who are red-green blind")],
		["#cvd-cl-protan", confusion("protans", "people who are (also) red-green blind")],
		["#cvd-cl-tritan", confusion("tritans", "people who are blue-yellow blind")]
	],
	psimi: [
		["#cvd-mat-deutan", separability("color blind people (deutans)")],
		["#cvd-mat-protan", separability("color blind people (protans)")],
		["#cvd-mat-tritan", separability("color blind people (tritans)")]
	],
	hue_neck: [["#hcl-hues", [
		{ target: ALL, text: "The <b>hue necklace</b> shows all hues as a circle. The palette colors (1, 2, 3, …) are placed on it by their hue." },
		{ target: ALL, text: "Use it to check how the hues are distributed. Are the colors of a categorical palette spread equally? Does a sequential palette use a single hue, or a spectrum of hues?" }
	]]],
	cl: [["#hcl-cl", [
		{ target: [0, 0, 0.1, 0.92], text: "Vertical axis: <b>luminance</b>, how bright the colors are." },
		{ target: [0.08, 0.9, 0.92, 0.1], text: "Horizontal axis: <b>chroma</b>, how vivid (saturated) the colors are." },
		{ target: [0.1, 0, 0.9, 0.9], text: "The box shows the ranges of chroma and luminance of the palette. Small ranges mean the colors stand out about equally: see Fairness." }
	]]],
	fair: [["#hcl-fair", [
		{ target: ALL, text: "<b>Fairness</b>: do the palette colors stand out about equally? The square is this palette: its chroma range and luminance range." },
		{ target: [0.08, 0.9, 0.92, 0.1], text: "The lower the chroma range (horizontal axis), the more equally saturated the colors." },
		{ target: [0, 0, 0.1, 0.92], text: "The lower the luminance range (vertical axis), the more equally bright the colors." },
		{ target: [0.1, 0, 0.9, 0.9], text: "Together they give the fairness score (the contour lines): the higher the score, the fairer the palette." }
	]]],
	cr: [["#cr-matrix", [
		{ target: [[0.07, 0.14, 0.07, 0.8], [0.14, 0.05, 0.6, 0.085]], text: "Each cell compares two colors: <b>color 1</b> (its row) and <b>color 2</b> (its column). White and black are added to check text readability." },
		{ target: MAT.sel, text: "The <b>contrast ratio</b> between these two colors indicates how well they can be distinguished. Click a cell, or a color in the row or column, to select another pair." },
		{ target: [0.78, 0.07, 0.2, 0.48], text: "Filled symbols: low contrast, so the colors are hard to distinguish; borders are recommended. Open symbols: high contrast, suitable for text." }
	]]],
	blues: [["#blues-rings", [
		{ target: ALL, text: "Do you see a 3D effect? <b>Chromostereopsis</b> is a visual illusion that may occur when a blue color is shown next to a red color, especially on a dark background." },
		{ target: ALL, text: "If you don't see it, check <i>Use optical illusion's original colors</i> below, and compare." }
	]]],
	naming: [["#naming-plot", [
		{ target: [0.01, 0, 0.99, 0.33], text: "Top: for each color name, a cloud of colors that people call by that name." },
		{ target: [0, 0.33, 0.085, 0.67], text: "Left: the palette colors." },
		{ target: [0.085, 0.33, 0.915, 0.67], text: "A dot shows how likely it is that a palette color gets that name: the bigger, the more likely." },
		{ target: [0.085, 0.33, 0.915, 0.67], text: "Lines are warnings. A horizontal line: the palette color has no unique name. A vertical line: several palette colors can get the same name." }
	]]]
};

const ICON_ON = "ⓘ";
const ICON_OFF = "✕";
const PAD = 6; // px around a highlighted element

const tours = {}; // key -> { step, hosts: [{ el, steps, overlay, card }], btn }

// The plot inside a plot element (svg or canvas)
const plotOf = el => el.querySelector("svg, canvas") || el;

function wrap(el) {
	if (el.parentElement.classList.contains("tour-host")) return el.parentElement;
	const host = document.createElement("div");
	host.className = "tour-host";
	el.parentNode.insertBefore(host, el);
	host.appendChild(el);
	return host;
}

// Rectangles (in px, relative to the host) of a step's target
function targetRects(el, target) {
	const host = el.parentElement;
	const hb = host.getBoundingClientRect();
	const pb = plotOf(el).getBoundingClientRect();
	const toPx = ([x, y, w, h]) => ({ x: pb.left - hb.left + x * pb.width, y: pb.top - hb.top + y * pb.height, w: w * pb.width, h: h * pb.height });
	if (typeof target === "string") {
		const t = el.querySelector(target);
		if (!t) return [toPx(ALL)];
		const b = t.getBoundingClientRect();
		return [{ x: b.left - hb.left - PAD, y: b.top - hb.top - PAD, w: b.width + 2 * PAD, h: b.height + 2 * PAD }];
	}
	return (Array.isArray(target[0]) ? target : [target]).map(toPx);
}

function drawStep(key) {
	const t = tours[key];
	for (const h of t.hosts) {
		const steps = h.steps, i = Math.min(t.step, steps.length - 1), st = steps[i];
		const host = h.el.parentElement;
		const hb = host.getBoundingClientRect();
		const pb = plotOf(h.el).getBoundingClientRect();
		const ox = pb.left - hb.left, oy = pb.top - hb.top;
		const rects = targetRects(h.el, st.target);
		const W = host.clientWidth, H = Math.ceil(oy + pb.height + PAD);
		const r = x => Math.round(x * 10) / 10;
		const holes = rects.map(q => `<rect x="${r(q.x)}" y="${r(q.y)}" width="${r(q.w)}" height="${r(q.h)}" rx="6"/>`).join("");
		h.overlay.setAttribute("viewBox", `0 0 ${W} ${H}`);
		h.overlay.style.width = W + "px";
		h.overlay.style.height = H + "px";
		h.overlay.innerHTML = `
			<defs><mask id="tour-mask-${h.id}">
				<rect x="${r(ox)}" y="${r(oy)}" width="${r(pb.width)}" height="${r(pb.height)}" fill="white"/>
				<g fill="black">${holes}</g>
			</mask></defs>
			<rect class="tour-dim" x="${r(ox)}" y="${r(oy)}" width="${r(pb.width)}" height="${r(pb.height)}" mask="url(#tour-mask-${h.id})"/>
			<g class="tour-ring">${holes}</g>`;
		h.overlay.classList.remove("enter");
		void h.overlay.getBoundingClientRect(); // restart the animation
		h.overlay.classList.add("enter");

		h.card.querySelector(".tour-text").innerHTML = st.text;
		h.card.querySelector(".tour-count").textContent = `${i + 1} / ${steps.length}`;
		h.card.querySelector(".tour-dots").innerHTML = steps.map((_, j) => `<span class="${j === i ? "on" : ""}"></span>`).join("");
		h.card.querySelector("[data-act=prev]").disabled = i === 0;
		const next = h.card.querySelector("[data-act=next]");
		next.textContent = i === steps.length - 1 ? "Done" : "Next ›";
	}
}

function makeCard() {
	const card = document.createElement("div");
	card.className = "tour-card";
	card.setAttribute("role", "region");
	card.setAttribute("aria-label", "Explanation");
	card.setAttribute("aria-live", "polite");
	card.tabIndex = -1;
	card.innerHTML = `<p class="tour-text"></p>
		<div class="tour-nav">
			<span class="tour-dots" aria-hidden="true"></span><span class="tour-count"></span>
			<button type="button" data-act="prev">‹ Back</button>
			<button type="button" data-act="next">Next ›</button>
			<button type="button" class="tour-close" data-act="close" aria-label="Close explanation" title="Close">✕</button>
		</div>`;
	return card;
}

let uid = 0;

function open(key, btn) {
	const hosts = TOURS[key].map(([sel, steps]) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		const host = wrap(el);
		host.classList.add("touring");
		const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		overlay.classList.add("tour-overlay");
		overlay.setAttribute("aria-hidden", "true");
		const card = makeCard();
		card.addEventListener("click", e => {
			const act = e.target.closest("button")?.dataset.act;
			if (act === "prev") go(key, -1);
			else if (act === "next") go(key, +1);
			else if (act === "close") close(key);
		});
		card.addEventListener("keydown", e => {
			if (e.key === "ArrowRight") go(key, +1);
			else if (e.key === "ArrowLeft") go(key, -1);
			else if (e.key === "Escape") close(key);
		});
		host.append(overlay, card);
		// redraw when the plot changes (another palette, another selected pair)
		const mo = new MutationObserver(() => requestAnimationFrame(() => tours[key] && drawStep(key)));
		mo.observe(el, { childList: true, subtree: true, attributes: true });
		return { el, steps, overlay, card, mo, id: ++uid };
	}).filter(Boolean);
	tours[key] = { step: 0, hosts, btn };
	btn.setAttribute("aria-pressed", "true");
	btn.textContent = ICON_OFF;
	btn.title = "Hide explanation";
	drawStep(key);
	hosts[0]?.card.focus({ preventScroll: true });
}

function go(key, d) {
	const t = tours[key];
	const n = Math.max(...t.hosts.map(h => h.steps.length));
	if (t.step + d >= n) { close(key); return; }
	t.step = Math.max(0, t.step + d);
	drawStep(key);
}

function close(key) {
	const t = tours[key];
	if (!t) return;
	for (const h of t.hosts) {
		h.mo.disconnect();
		h.overlay.remove();
		h.card.remove();
		h.el.parentElement.classList.remove("touring");
	}
	t.btn.setAttribute("aria-pressed", "false");
	t.btn.textContent = ICON_ON;
	t.btn.title = "Explain this plot";
	delete tours[key];
}

export function setupInfo() {
	for (const list of Object.values(TOURS)) for (const [sel] of list) {
		const el = document.querySelector(sel);
		if (el) wrap(el);
	}
	document.querySelectorAll(".ani-btn").forEach(btn => {
		const key = btn.dataset.ani;
		if (!TOURS[key]) return;
		btn.textContent = ICON_ON;
		btn.title = "Explain this plot";
		btn.setAttribute("aria-pressed", "false");
		btn.addEventListener("click", () => (tours[key] ? close(key) : open(key, btn)));
	});
	window.addEventListener("resize", () => Object.keys(tours).forEach(drawStep));
}
