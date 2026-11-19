# Export cols4all palette data and precomputed scores to JSON for the website.
#
# Usage (from the cols4all-web root):
#   Rscript R/export_data.R [path/to/cols4all-R]
#
# With a path, the development version of cols4all is loaded via
# devtools::load_all(); otherwise the installed package is used.
#
# Output (data/):
#   meta.json      types, labels, icons, thresholds, series descriptions
#   refs.json      citation (APA) and BibTeX per palette
#   <type>.json    per palette type: palette info + for every number of
#                  colors n (and m for bivariate): colors and scores
#
# The scores are taken from cols4all's own get_z_n() and show_attach_scores(),
# so the website shows exactly what c4a_table() shows (default range and
# color order).

args = commandArgs(trailingOnly = TRUE)
pkg_path = if (length(args)) args[1] else "../cols4all-R"

if (dir.exists(pkg_path)) {
	devtools::load_all(pkg_path, quiet = TRUE)
	ns = asNamespace("cols4all")
} else {
	library(cols4all)
	ns = asNamespace("cols4all")
}

C4A = get(".C4A", envir = ns)
get_z_n = get("get_z_n", envir = ns)
show_attach_scores = get("show_attach_scores", envir = ns)
filter_labels = get(".filter_labels", envir = ns)

out_dir = "data"
dir.create(out_dir, showWarnings = FALSE)

write_json = function(x, file) {
	jsonlite::write_json(x, file.path(out_dir, file), auto_unbox = TRUE, digits = NA, na = "null", null = "null")
	message(sprintf("%-12s %6.0f kB", file, file.size(file.path(out_dir, file)) / 1024))
}

z = C4A$z
# keep the original order of .C4A$z: c4a_table() breaks sorting ties by it

# numbers to JSON: non-finite (Inf) as null
fin = function(x) { x[!is.finite(x)] = NA; x }

# Score columns exported per row (all columns that c4a_table can show or sort/filter on)
score_cols = c("min_dist", "min_step", "max_step", "inter_wing_dist", "tri_ineq",
			   "min_dist_none", "min_dist_deutan", "min_dist_protan", "min_dist_tritan",
			   "min_dist_overall", "min_dist_overall_dp",
			   "nameability", "Cmax", "H", "HL", "HR", "Lmid", "Hwidth", "HwidthL", "HwidthR", "HwidthLR",
			   "Hspread", "Lrange", "Crange", "fairness", "CRmin", "CRwt", "CRbk", "Blues",
			   "cbfriendly", "cbf_none", "cbf_deutan", "cbf_protan", "cbf_tritan",
			   "chroma", "fair", "hues", "equiluminance", "contrastWT", "contrastBK", "float", "nameable")

# n (and m) combinations per type, as offered by the c4a_gui sliders
nm_combos = function(type, zt) {
	if (substr(type, 1, 3) != "biv") {
		nmin = max(min(zt$nmin), if (type == "div") 3 else 2)
		nmax = max(zt$nmax[is.finite(zt$nmax)], 15)
		data.frame(n = nmin:nmax, m = 1)
	} else {
		ns = if (type == "bivd") c(3, 5, 7) else 2:(if (type == "bivc") 10 else 7)
		ms = if (type == "bivd") c(3, 5, 7) else 2:7
		if (type == "bivs") data.frame(n = ns, m = ns) else expand.grid(n = ns, m = ms)
	}
}

rows_for = function(zt, n, m) {
	zn = get_z_n(zt, n = n, m = m)
	if (is.null(zn)) return(NULL)
	zn = zn[!vapply(zn$palette, is.null, logical(1)), ]
	if (!nrow(zn)) return(NULL)
	s = show_attach_scores(zn, include_tritan = TRUE)
	s_dp = show_attach_scores(zn, include_tritan = FALSE)
	lapply(seq_len(nrow(s)), function(i) {
		p = s$palette[[i]]
		# bivariate: row-major (rows = m, columns = n), as in c4a_table
		cols = if (is.matrix(p)) as.vector(t(p)) else as.vector(p)
		sc = lapply(intersect(score_cols, names(s)), function(cn) {
			v = s[[cn]][i]
			if (is.numeric(v)) fin(v) else v
		})
		names(sc) = intersect(score_cols, names(s))
		sc$cbfriendly_dp = s_dp$cbfriendly[i]
		c(list(f = s$fullname[i], c = cols), sc)
	})
}

types = unname(C4A$types)

for (type in types) {
	zt = z[z$type == type, ]
	if (!nrow(zt)) next
	combos = nm_combos(type, zt)
	rows = list()
	for (i in seq_len(nrow(combos))) {
		n = combos$n[i]; m = combos$m[i]
		key = if (substr(type, 1, 3) == "biv") paste0(n, "x", m) else as.character(n)
		r = rows_for(zt, n, m)
		if (!is.null(r)) rows[[key]] = r
	}
	pals = lapply(seq_len(nrow(zt)), function(i) {
		x = list(name = zt$name[i], series = zt$series[i], na = zt$na[i],
			 nmin = fin(zt$nmin[i]), nmax = fin(zt$nmax[i]), ndef = fin(zt$ndef[i]),
			 mmin = fin(zt$mmin[i]), mmax = fin(zt$mmax[i]), mdef = fin(zt$mdef[i]))
		if (type %in% c("seq", "div", "cyc")) {
			# needed for a manual range (see get_pal_n()): the palette that is interpolated
			p = zt$palette[[i]]
			index = attr(p, "index")
			x$base = as.vector(if (is.null(index)) p else p[index[[length(index)]]])
			x$space = attr(p, "space")
		}
		x
	})
	names(pals) = zt$fullname
	write_json(list(type = type, palettes = pals, rows = rows), paste0(type, ".json"))
}

# References
refs = lapply(seq_len(nrow(z)), function(i) list(cit = z$cit[i], bib = z$bib[i]))
names(refs) = z$fullname
write_json(refs, "refs.json")

# Icons: .C4A$tc holds kableExtra::cell_spec arguments: the unnamed element is the text
icon_spec = function(x) {
	if (!is.list(x)) return(if (identical(x, "")) NULL else list(html = x))
	nms = names(x)
	list(html = x[[which(nms == "")[1]]], tooltip = x$tooltip, css = x$extra_css)
}
icons = lapply(C4A$tc, function(tci) {
	nested = any(names(tci) %in% c("seq", "cat", "div", "cyc"))
	if (nested) lapply(tci, function(tcii) lapply(tcii, icon_spec)) else lapply(tci, icon_spec)
})
headers = lapply(C4A$th, function(x) icon_spec(x))

# Number of palettes per series and type (Overview button)
zz = z
overview = as.data.frame.matrix(table(zz$series, factor(zz$type, levels = types)))

meta = list(
	types = as.list(C4A$types),
	types1 = as.list(C4A$types1),
	types2 = lapply(C4A$types2, as.list),
	type_info = C4A$type_info,
	ndef = as.list(fin(C4A$ndef)),
	mdef = as.list(fin(C4A$mdef)),
	labels = as.list(C4A$labels),
	sortRev = C4A$sortRev,
	icons = icons,
	headers = headers,
	filter_labels = as.list(filter_labels),
	series = as.list(C4A$zdes[sort(unique(z$series))]),
	overview = list(series = rownames(overview), types = types, counts = unname(as.matrix(overview))),
	matrix = lapply(c(CR = "CR", dist = "dist"), function(tp) list(
		pchs = C4A$matrix_pchs[[tp]], sizes = C4A$matrix_sizes[[tp]],
		labels = C4A$matrix_interval_labels[[tp]], breaks = C4A$matrix_breaks[[tp]])),
	thresholds = list(Blues = C4A$Blues, Cgray = C4A$Cgray),
	version = as.character(utils::packageVersion("cols4all")),
	exported = format(Sys.time(), "%Y-%m-%d")
)
write_json(meta, "meta.json")

# Data for the example plots (Application tab etc.): internal objects of cols4all
shp = get("shp", envir = ns)
bbx = get("bbx", envir = ns)
rdata = get("rdata", envir = ns)

# polygons (one ring per path) as SVG path strings, coordinates in km relative to bbx
sx = (as.numeric(shp$x) - bbx[["xmin"]]) / 1000
sy = (bbx[["ymax"]] - as.numeric(shp$y)) / 1000
ids = rep(seq_along(shp$id.lengths), shp$id.lengths)
paths = unname(vapply(split(seq_along(sx), ids), function(i) {
	paste0("M", paste(sprintf("%.1f,%.1f", sx[i], sy[i]), collapse = "L"), "Z")
}, character(1)))

write_json(list(
	map = list(paths = paths, width = (bbx[["xmax"]] - bbx[["xmin"]]) / 1000, height = (bbx[["ymax"]] - bbx[["ymin"]]) / 1000),
	scatter = list(x = round(rdata$scatter.x, 4), y = round(rdata$scatter.y, 4)),
	bars = rdata$bars.x,
	lines = list(x = rdata$lines.x, s = lapply(rdata$lines.s, round, 4))
), "examples.json")

# HCL Analysis tab
#  - hcl space (3D plotly): sample of colors + polar grid of volcano3D
#  - hue necklace: background points
#  - fairness: contour lines (LC) and curve (C)
pg = rdata$hdf_pg
hdf = rdata$hdf
necklace_max_c = colorspace::max_chroma(h = rdata$necklace.h, l = rdata$necklace.l)
necklace_cols = grDevices::hcl(rdata$necklace.h, rdata$necklace.c * necklace_max_c, rdata$necklace.l)
nd = 0.4 + (rdata$necklace.d - 0.5) * 0.02

get_fairness = get("get_fairness", envir = ns)
dL = seq(0, 100, by = 1)[2:100]
dC = seq(0, 160, by = 1.6)[2:100]
df = expand.grid(L = dL, C = dC)
fm = t(matrix(get_fairness(df$L, df$C, round = FALSE), nrow = length(dL)))[length(dC):1L, ]
clines = lapply(grDevices::contourLines(z = fm, levels = seq(10, 90, by = 10)), function(cli) {
	id = round(length(cli$x) * .75)
	list(level = cli$level, C = round(160 - cli$x * 160, 3), L = round(cli$y * 100, 3),
		 labC = (1 - cli$x[id]) * 160, labL = cli$y[id] * 100)
})
fC = seq(0, 160, by = .5)

write_json(list(
	space = list(x = round(hdf$x, 2), y = round(hdf$y, 2), L = round(hdf$L, 2), hex = hdf$hex,
				 H = round(hdf$H, 2), C = round(hdf$C, 2),
				 grid = list(x = round(pg@polar_grid$x / pg@r * 180, 3), y = round(pg@polar_grid$y / pg@r * 180, 3), z = pg@polar_grid$z),
				 r = pg@r, z_breaks = pg@z_breaks),
	necklace = list(x = round(sin(rdata$necklace.h / 180 * pi) * nd + 0.5, 5),
					y = round(cos(rdata$necklace.h / 180 * pi) * nd + 0.55, 5),
					hex = necklace_cols),
	fairness = list(contours = clines, C = fC, F = round(get_fairness(0, fC, round = FALSE), 4),
					Lrange_mid = C4A$Lrange_mid, Lrange_steep = C4A$Lrange_steep,
					Crange_mid = C4A$Crange_mid, Crange_steep = C4A$Crange_steep)
), "hcl.json")

# Naming tab: the naming model (beta distributions of H, C and L per color name),
# the example colors per name, and the softmax parameters
model = C4A$naming_fun_args$model
write_json(list(
	names = names(C4A$naming_colors),
	model = lapply(model, function(md) lapply(md[c("H", "C", "L")], function(r) list(
		shape1 = unname(r$fit$estimate["shape1"]), shape2 = unname(r$fit$estimate["shape2"]),
		mn = unname(r$mn), mx = unname(r$mx)))),
	softmax = C4A$naming_softmax,
	examples = lapply(C4A$name_data, function(d) list(hex = d$hex, x = round(d$x, 4), y = round(d$y, 4)))
), "naming.json")

# Color Discrimination tab: chromaticity diagram (as in cols4all:::plot_rgb), per color vision type
rgb_data = get("rgb_data", envir = ns)
sim_cvd = get("sim_cvd", envir = ns)
dir.create("img/chromaticity", showWarnings = FALSE)
for (cvd in c("none", "deutan", "protan", "tritan")) {
	cols = rgb_data$cols_list[["L100"]]
	nr = rgb_data$res[1]
	sc = cols
	sc[!is.na(cols)] = sim_cvd(cols[!is.na(cols)], cvd)
	m = matrix(sc, nrow = nr, byrow = TRUE)[nr:1, ]
	rgba = array(0, dim = c(nrow(m), ncol(m), 4))
	ok = !is.na(m)
	v = grDevices::col2rgb(m[ok]) / 255
	for (k in 1:3) { ch = matrix(0, nrow(m), ncol(m)); ch[ok] = v[k, ]; rgba[, , k] = ch }
	rgba[, , 4] = ok * 1
	png::writePNG(rgba, file.path("img/chromaticity", paste0(cvd, ".png")))
}
meta_cvd = list(xrange = rgb_data$xrange, yrange = rgb_data$yrange)
jsonlite::write_json(meta_cvd, file.path(out_dir, "chromaticity.json"), auto_unbox = TRUE, digits = NA)
