// HCL Analysis tab (c4a_gui's "HCL Analysis" tab)

import { huesSVG, clSVG, fairSVG, hclSpace } from "../plots/hcl.js";

const $ = sel => document.querySelector(sel);

export const hclDefaults = { H: "0-360", C: "0-180", L: "0-100", palcols: false };

const parseRange = v => v.split("-").map(Number);

// ctx: { state, getSelection(), isDark(), loadJSON(), changed() }
export function setupHCL(ctx) {
	const s = ctx.state;

	document.querySelectorAll("#tab-hcl .dual-range").forEach(dr => {
		const key = dr.dataset.key;
		const [a, b] = dr.querySelectorAll("input");
		const update = moved => {
			let lo = +a.value, hi = +b.value;
			if (lo > hi) {
				if (moved === a) { hi = lo; b.value = hi; } else { lo = hi; a.value = lo; }
			}
			s[key] = `${lo}-${hi}`;
			$(`#hcl-${key}-out`).textContent = `${lo} – ${hi}`;
		};
		[a, b].forEach(x => x.addEventListener("input", () => { update(x); renderSpace(); ctx.changed(); }));
	});
	$("#hcl-palcols").addEventListener("change", e => { s.palcols = e.target.checked; renderSpace(); ctx.changed(); });

	function sync() {
		document.querySelectorAll("#tab-hcl .dual-range").forEach(dr => {
			const key = dr.dataset.key;
			const [lo, hi] = parseRange(s[key]);
			const [a, b] = dr.querySelectorAll("input");
			a.value = lo; b.value = hi;
			$(`#hcl-${key}-out`).textContent = `${lo} – ${hi}`;
		});
		$("#hcl-palcols").checked = s.palcols;
	}

	let spaceTimer;
	function renderSpace() {
		clearTimeout(spaceTimer);
		spaceTimer = setTimeout(async () => {
			const sel = ctx.getSelection();
			const hd = await ctx.loadJSON("hcl");
			const el = $("#hcl-space");
			if (el.querySelector(".placeholder")) el.innerHTML = "";
			try {
				await hclSpace(el, hd, {
					H: parseRange(s.H), C: parseRange(s.C), L: parseRange(s.L),
					colors: s.palcols && sel && sel.cols.length ? sel.cols : null,
					dark: ctx.isDark()
				});
			} catch (e) {
				el.innerHTML = `<p class="placeholder">${e.message}</p>`;
			}
		}, 150);
	}

	async function render() {
		renderSpace();
		const sel = ctx.getSelection();
		const outs = ["#hcl-hues", "#hcl-cl", "#hcl-fair"];
		if (!sel || !sel.cols.length) {
			outs.forEach(o => ($(o).innerHTML = ""));
			return;
		}
		const hd = await ctx.loadJSON("hcl");
		const dark = ctx.isDark();
		$("#hcl-hues").innerHTML = huesSVG(hd, sel.cols, { dark });
		$("#hcl-cl").innerHTML = clSVG(sel.cols, { dark });
		$("#hcl-fair").innerHTML = fairSVG(hd, sel.cols, { dark, type: sel.type === "cat" ? "LC" : "C" });
	}

	sync();
	return { render, sync };
}
