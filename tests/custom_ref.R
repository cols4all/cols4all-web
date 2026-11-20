# Reference scores of a few custom palettes, computed by cols4all (c4a_data + c4a_load),
# for tests/score.test.mjs. Run from the repository root:
#   Rscript tests/custom_ref.R ../cols4all-R
args = commandArgs(trailingOnly = TRUE)
pkg_path = if (length(args)) args[1] else "../cols4all-R"
suppressMessages(devtools::load_all(pkg_path, quiet = TRUE))
ns = asNamespace("cols4all")
get_z_n = get("get_z_n", envir = ns)
show_attach_scores = get("show_attach_scores", envir = ns)
C4A = get(".C4A", envir = ns)

pals = list(
	okabe = list(type = "cat", cols = c("#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7")),
	traffic = list(type = "cat", cols = c("#FF0000", "#FFA500", "#00FF00", "#0000FF", "#222222", "#EEEEEE")),
	greens = list(type = "seq", cols = c("#F7FCF5", "#C7E9C0", "#74C476", "#238B45", "#00441B")),
	sunset = list(type = "seq", cols = c("#FFFFCC", "#FD8D3C", "#800026")),
	purple_green = list(type = "div", cols = c("#762A83", "#C2A5CF", "#F7F7F7", "#A6DBA0", "#1B7837")),
	wheel = list(type = "cyc", cols = c("#E41A1C", "#377EB8", "#4DAF4A", "#984EA3")),
	# bivariate: colors by row, ncol columns (biv.method = "byrowX")
	pu_gn = list(type = "bivs", ncol = 3, cols = c("#E8E8E8", "#ACE4E4", "#5AC8C8", "#DFB0D6", "#A5ADD3", "#5698B9", "#BE64AC", "#8C62AA", "#3B4994")),
	pu_gn4 = list(type = "bivs", ncol = 4, cols = c("#F3F3F3", "#C4E0E3", "#8FCBD0", "#52B4BC", "#E6C2DA", "#B8B0CF", "#869EC3", "#4E8AB6", "#D88EC2", "#AC80B8", "#7C72AC", "#4762A0", "#C960AA", "#9F55A0", "#734A95", "#40408A")),
	land = list(type = "bivc", ncol = 4, cols = c("#B2DF8A", "#A6CEE3", "#FB9A99", "#FDBF6F", "#33A02C", "#1F78B4", "#E31A1C", "#FF7F00")),
	vote = list(type = "bivd", ncol = 3, cols = c("#D7E3F4", "#F0F0F0", "#F6D5D5", "#8DB4E2", "#BDBDBD", "#E99A9A", "#2C6FBB", "#737373", "#C83232")),
	certain = list(type = "bivg", ncol = 3, cols = c("#DEEBF7", "#E8EEF2", "#EEEEEE", "#9ECAE1", "#B3C5D1", "#C2C2C2", "#3182BD", "#6E8CA0", "#8C8C8C"))
)

out = list()
for (nm in names(pals)) {
	p = pals[[nm]]
	isbiv = substr(p$type, 1, 3) == "biv"
	x = c4a_data(setNames(list(p$cols), nm), types = p$type, series = "custom", remove.blacks = FALSE, remove.whites = FALSE,
				 biv.method = if (isbiv) paste0("byrow", p$ncol) else "byrow")
	c4a_load(x, overwrite = TRUE)
	z = C4A$z
	z = z[z$fullname == paste0("custom.", nm), ]
	combos = if (p$type == "cat") {
		data.frame(n = 2:length(p$cols), m = 1)
	} else if (!isbiv) {
		data.frame(n = (C4A$nmin[[p$type]]):15, m = 1)
	} else {
		nmx = if (p$type == "bivc") min(p$ncol, 10) else 7
		cmb = expand.grid(n = (C4A$nmin[[p$type]]):nmx, m = 2:7)
		if (p$type == "bivs") cmb[cmb$n == cmb$m, ] else cmb
	}
	rows = lapply(seq_len(nrow(combos)), function(i) {
		n = combos$n[i]; m = combos$m[i]
		zn = get_z_n(z, n = n, m = m)
		s = show_attach_scores(zn, include_tritan = TRUE)
		s_dp = show_attach_scores(zn, include_tritan = FALSE)
		r = as.list(s[1, intersect(names(s), c("min_dist", "min_step", "max_step", "inter_wing_dist", "tri_ineq",
			"min_dist_none", "min_dist_deutan", "min_dist_protan", "min_dist_tritan", "min_dist_overall", "min_dist_overall_dp",
			"nameability", "Cmax", "H", "HL", "HR", "Lmid", "Hwidth", "HwidthL", "HwidthR", "HwidthLR",
			"Hspread", "Lrange", "Crange", "fairness", "CRmin", "CRwt", "CRbk", "Blues",
			"cbfriendly", "cbf_none", "cbf_deutan", "cbf_protan", "cbf_tritan",
			"chroma", "fair", "hues", "equiluminance", "contrastWT", "contrastBK", "float", "nameable"))])
		r = lapply(r, function(v) if (is.numeric(v) && !is.finite(v)) NA else v)
		r$cbfriendly_dp = s_dp$cbfriendly[1]
		pal = s$palette[[1]]
		c(list(n = n, m = m, c = if (is.matrix(pal)) as.vector(t(pal)) else as.vector(pal)), r)
	})
	out[[nm]] = list(type = p$type, colors = p$cols, ncol = if (isbiv) p$ncol else NA, na = z$na, rows = rows)
}
jsonlite::write_json(out, "tests/custom_ref.json", auto_unbox = TRUE, digits = NA, na = "null", null = "null", pretty = FALSE)
message("written tests/custom_ref.json")
