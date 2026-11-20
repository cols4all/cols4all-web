# cols4all-web

Static website version of the `c4a_gui()` dashboard of the R package
[cols4all](https://github.com/cols4all/cols4all-R), to be served on
cols4all.org.

The site runs fully in the browser: no R, no server.

- `R/export_data.R` exports the palettes and precomputed scores from cols4all to `data/*.json`.
- `index.html`, `css/` and `js/` are the site itself (plain ES modules, no build step).

## Update the data

From this directory, with the cols4all-R repository next to it:

```sh
Rscript R/export_data.R ../cols4all-R
```

Without a path argument (or if it does not exist), the installed cols4all package is used.

## Run locally

ES modules need to be served over http:

```sh
python3 -m http.server 8000
```

and open <http://localhost:8000>.

## Tests

The scores of palettes entered on the site ("Test your own palette") are computed in the browser by `js/score.js`, a port of the cols4all scoring code. A parity test checks them against the scores computed in R:

```sh
node tests/score.test.mjs
```

It compares all built-in palettes (`data/*.json`) and a few custom palettes made with `c4a_data()` + `c4a_load()` (`tests/custom_ref.json`, created by `Rscript tests/custom_ref.R ../cols4all-R`). Rerun both after changing the scoring code in cols4all.

## Status

- [x] Overview tab
- [x] Shareable links: the settings are stored in the URL (back/forward buttons work per tab and palette)
- [x] Palette search, and a details panel per palette (click a row)
- [x] Step-by-step explanations of the analysis plots (ⓘ buttons)
- [x] Phone layout: compact table, collapsible settings
- [x] Test your own palettes (all types, including bivariate): scored in the browser, stored in the URL
- [x] Color Discrimination
- [x] HCL Analysis
- [x] Contrast
- [x] 3D Blues
- [x] Naming
- [x] Application
