// 3D Blues tab: cols4all:::approx_blues(), approx_reds() and c4a_plot_floating_rings()

import { hexToRgb } from "../color.js";
import { roundR } from "../colorops.js";

// blue (red) channel relative to the maximum of the other two, in %
function approx(p, ch, others) {
	return p.map(c => {
		let rgb = hexToRgb(c);
		if (rgb[0] + rgb[1] + rgb[2] === 0) rgb = [1, 1, 1];
		return roundR(rgb[ch] / Math.max(rgb[others[0]], rgb[others[1]]) * 100);
	});
}
export const approxBlues = p => approx(p, 2, [0, 1]);
export const approxReds = p => approx(p, 0, [1, 2]);

let ringsPromise = null;
function loadRings() {
	if (!ringsPromise) {
		ringsPromise = new Promise((resolve, reject) => {
			const im = new Image();
			im.onload = () => {
				const c = document.createElement("canvas");
				c.width = im.naturalWidth; c.height = im.naturalHeight;
				const ctx = c.getContext("2d");
				ctx.drawImage(im, 0, 0);
				resolve(ctx.getImageData(0, 0, c.width, c.height));
			};
			im.onerror = reject;
			im.src = "img/floating_rings.png";
		});
	}
	return ringsPromise;
}

// col1: pixels with red channel 1 (outer and inner ring), col2: pixels with blue channel 1
export async function floatingRings(canvas, col1, col2, dark = true) {
	const x = await loadRings();
	canvas.width = x.width; canvas.height = x.height;
	const ctx = canvas.getContext("2d");
	const out = ctx.createImageData(x.width, x.height);
	const a = hexToRgb(col1), b = hexToRgb(col2);
	for (let i = 0; i < x.data.length; i += 4) {
		const id1 = x.data[i] === 255, id2 = x.data[i + 2] === 255;
		const col = id2 ? b : id1 ? a : dark ? [x.data[i], x.data[i + 1], x.data[i + 2]] : [255, 255, 255];
		out.data[i] = col[0]; out.data[i + 1] = col[1]; out.data[i + 2] = col[2]; out.data[i + 3] = 255;
	}
	ctx.putImageData(out, 0, 0);
}
