// Info animations (as in c4a_gui): a button next to a plot title toggles an
// animated GIF that explains the plot, drawn on top of the plot.
//
// key -> list of [plot element, GIF name (img/info/<name>1x.gif / 2x.gif), plot width in px].
// The GIFs are made for the R plots at their GUI sizes; the plots here have
// the same layout, so the GIF is scaled along with the plot.
const ANIMATIONS = {
	simu: [["#cvd-strip", "simu", 800]],
	hue_lines: [["#cvd-cl-none", "hue_lines", 375]],
	simi: [["#cvd-mat-none", "simi", 500]],
	conf: [["#cvd-cl-deutan", "conf_linesD", 375], ["#cvd-cl-protan", "conf_linesP", 375], ["#cvd-cl-tritan", "conf_linesT", 375]],
	psimi: [["#cvd-mat-deutan", "simiD", 500], ["#cvd-mat-protan", "simiP", 500], ["#cvd-mat-tritan", "simiT", 500]],
	hue_neck: [["#hcl-hues", "hue_neck", 400]],
	cl: [["#hcl-cl", "cl_plot", 600]],
	fair: [["#hcl-fair", "fair_plot", 600]],
	cr: [["#cr-matrix", "table", 400]],
	blues: [["#blues-rings", "blues", 550]],
	naming: [["#naming-plot", "naming", 1000]]
};

const ICON_ON = "ⓘ"; // circled i
const ICON_OFF = "✕"; // x

// Wrap each plot element in a container that also holds its (hidden) overlay
function wrap(sel) {
	const el = document.querySelector(sel);
	if (!el || el.parentElement.classList.contains("ani-host")) return el?.parentElement;
	const host = document.createElement("div");
	host.className = "ani-host";
	el.parentNode.insertBefore(host, el);
	host.appendChild(el);
	const img = document.createElement("img");
	img.className = "ani-overlay";
	img.alt = "";
	img.hidden = true;
	host.appendChild(img);
	return host;
}

export function setupInfo() {
	for (const list of Object.values(ANIMATIONS)) list.forEach(([sel]) => wrap(sel));

	document.querySelectorAll(".ani-btn").forEach(btn => {
		const list = ANIMATIONS[btn.dataset.ani];
		if (!list) return;
		btn.textContent = ICON_ON;
		btn.title = "Show explanation";
		btn.setAttribute("aria-pressed", "false");
		btn.addEventListener("click", () => {
			const on = btn.getAttribute("aria-pressed") !== "true";
			btn.setAttribute("aria-pressed", String(on));
			btn.textContent = on ? ICON_OFF : ICON_ON;
			btn.title = on ? "Hide explanation" : "Show explanation";
			for (const [sel, gif, plotW] of list) {
				const host = document.querySelector(sel).parentElement;
				const img = host.querySelector(".ani-overlay");
				if (on) {
					const probe = new Image();
					probe.onload = () => (img.style.width = `${probe.naturalWidth / plotW * 100}%`);
					probe.src = `img/info/${gif}1x.gif`;
					// restart the animation each time it is shown
					img.src = `img/info/${gif}1x.gif`;
					img.srcset = `img/info/${gif}1x.gif 1x, img/info/${gif}2x.gif 2x`;
				} else {
					img.removeAttribute("src");
					img.removeAttribute("srcset");
				}
				img.hidden = !on;
			}
		});
	});
}
