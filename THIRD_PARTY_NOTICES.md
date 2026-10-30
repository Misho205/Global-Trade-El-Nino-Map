# Third-party notices and data attribution

The root MIT license applies to original project contributions. It does not
replace licenses for third-party code, datasets, imagery or hosted services.
Provider names do not imply sponsorship or endorsement.

## Bundled software

| Material | Location | Notice |
| --- | --- | --- |
| CesiumJS distribution | `public/cesium/` | Preserve embedded notices, widget credits and applicable upstream component licenses. [Upstream license](https://github.com/CesiumGS/cesium/blob/main/LICENSE.md) |
| OpenAI Sites Vite integration | `build/sites-vite-plugin.ts` | MIT, copyright 2026 OpenAI; full text in `build/sites-vite-plugin.LICENSE` |
| shadcn Tailwind stylesheet | `vendor/shadcn-tailwind-4.13.0.css` | MIT, copyright 2023 shadcn; full text in `vendor/shadcn-tailwind-4.13.0.LICENSE.md` |
| npm dependencies | `package.json`, `package-lock.json` | Each package retains its own license and bundled notices; the lockfile is not a license inventory. |

Before distributing a release, inspect the exact bundled Cesium version, its
third-party assets and all dependency license obligations. This document is a
starting inventory, not a completed dependency-license audit. Keep full required
license texts and notices with distributed material; links alone may not suffice.

## Data and services

### AlphaEarth Foundations

Attribution: **The AlphaEarth Foundations Satellite Embedding dataset is produced
by Google and Google DeepMind.** The bundled manifest identifies CC BY 4.0.

- [Official catalog and terms](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Local provenance: `public/alphaearth/manifest.json`, retrieved 2026-10-08.

Changes: RGB visualization of de-quantized A00/A01/A02, normalized overview input,
nearest-neighbor reprojection from UTM to WGS84. Previews are approximately 320 m,
not the native 10 m dataset. Four port regions and 36 files are labeled 2017-2025
in this project's manifest; verify availability and each source record rather
than assuming identical coverage in every distribution of the upstream dataset.

### Natural Earth

Country boundaries derive from Natural Earth. **Made with Natural Earth.**
Natural Earth's published raster/vector data are public domain according to its
[terms](https://www.naturalearthdata.com/about/terms-of-use/). Boundaries are
cartographic conventions, not an assertion resolving sovereignty disputes.

### Online services

- Esri provides online imagery and elevation. Preserve the map's provider credits
  and review Esri service terms, attribution and permitted usage for your deployment.
  The project MIT license does not grant redistribution rights to downloaded tiles.
- NOAA supplies climate indices, discussions, coastal observations and tides.
  Preserve provenance, dates, datums and preliminary-data labels.
- UN Comtrade and WTO supply statistics and treaty records. Respect their API,
  access, attribution and redistribution terms and request limits.
- Flag images are requested from FlagCDN; retain appropriate source attribution
  and review its terms for your usage.
- Google Translate is an external service. Its widget and translations are not
  relicensed under the project MIT license.

See [data sources](docs/DATA-SOURCES.md) for direct links. EIA, UNCTAD, Panama Canal
Authority and Copernicus links are context/future-integration references, not proof
that their data are ingested by the collector.
