// Naming tab (c4a_gui's "Naming" tab)

import { namesSVG } from "../plots/naming.js";

const $ = sel => document.querySelector(sel);

// a: "clarity level" (softmax parameter); the default (8) is .C4A$naming_softmax$a
export const namingDefaults = { a: 8 };

// ctx: { state, getSelection(), isDark(), loadJSON(), changed() }
export function setupNaming(ctx) {
	const s = ctx.state;

	$("#naming-a").addEventListener("input", e => {
		s.a = +e.target.value;
		$("#naming-a-out").textContent = s.a;
		render();
		ctx.changed();
	});

	function sync() {
		$("#naming-a").value = s.a;
		$("#naming-a-out").textContent = s.a;
	}

	async function render() {
		const sel = ctx.getSelection();
		if (!sel || !sel.cols.length) {
			$("#naming-plot").innerHTML = `<p class="placeholder">No palette selected.</p>`;
			return;
		}
		const nd = await ctx.loadJSON("naming");
		// slider range as in c4a_gui: 0.5 to the default + 2
		$("#naming-a").max = nd.softmax.a + 2;
		$("#naming-plot").innerHTML = namesSVG(nd, sel.cols, { a: s.a, dark: ctx.isDark() });
	}

	sync();
	return { render, sync };
}
