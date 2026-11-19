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

## Status

- [x] Overview tab
- [x] Shareable links: the settings are stored in the URL
- [x] Color Discrimination
- [x] HCL Analysis
- [x] Contrast
- [x] 3D Blues
- [x] Naming
- [x] Application
