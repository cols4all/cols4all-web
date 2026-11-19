// Color conversions, matching colorspace (R) as used by cols4all

export function hexToRgb(hex) {
	const h = hex.replace("#", "");
	return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
}

// cols4all:::is_light
export function isLight(hex) {
	const [r, g, b] = hexToRgb(hex);
	return r * 0.299 + g * 0.587 + b * 0.114 >= 128;
}

// colorspace's C code: gamma 2.4 with threshold 0.03928
const srgbToLinear = v => {
	v /= 255;
	return v > 0.03928 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
};

// D65 white point, as in colorspace
const XN = 95.047, YN = 100.0, ZN = 108.883;

export function hexToXYZ(hex) {
	const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
	return [
		100 * (0.412453 * r + 0.357580 * g + 0.180423 * b),
		100 * (0.212671 * r + 0.715160 * g + 0.072169 * b),
		100 * (0.019334 * r + 0.119193 * g + 0.950227 * b)
	];
}

// colorspace: as(hex2RGB(x), "polarLUV"): returns [H, C, L]
// Same operations as colorspace's C code, so that the hue of grays (numerical noise) is the same
function XYZtoUV(X, Y, Z) {
	const t = X + Y + Z;
	if (t === 0) return [0, 0];
	const x = X / t, y = Y / t;
	return [2 * x / (6 * y - x + 1.5), 4.5 * y / (6 * y - x + 1.5)];
}
const UVN = XYZtoUV(XN, YN, ZN);

export function hexToHCL(hex) {
	const [X, Y, Z] = hexToXYZ(hex);
	const [u, v] = XYZtoUV(X, Y, Z);
	const y = Y / YN;
	const L = y > 0.008856 ? 116 * Math.pow(y, 1 / 3) - 16 : 903.3 * y;
	const U = 13 * L * (u - UVN[0]);
	const V = 13 * L * (v - UVN[1]);
	const C = Math.sqrt(U * U + V * V);
	let H = Math.atan2(V, U) * 180 / Math.PI;
	while (H < 0) H += 360;
	while (H >= 360) H -= 360;
	return [H, C, L];
}

// cols4all:::get_rgb_triple / get_hcl_triple
export const rgbTriple = hex => hexToRgb(hex).join(",");
export const hclTriple = hex => hexToHCL(hex).map(Math.round).join(",");

// colorspace: as(hex2RGB(x), "LAB"): returns [L, A, B] (CIELAB, D65 white as in colorspace)
export function hexToLAB(hex) {
	const [X, Y, Z] = hexToXYZ(hex);
	const f = t => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);
	const yr = Y / YN;
	const L = yr > 0.008856 ? 116 * Math.pow(yr, 1 / 3) - 16 : 903.3 * yr;
	const xt = f(X / XN), yt = f(yr), zt = f(Z / ZN);
	return [L, 500 * (xt - yt), 200 * (yt - zt)];
}
