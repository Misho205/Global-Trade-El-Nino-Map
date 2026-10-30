# Sources, coverage and interpretation

| Source | Usage | Coverage/limits |
| --- | --- | --- |
| [NOAA CPC](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml) | Current ENSO discussion | Provider publication schedule; HTML format can change |
| [NOAA PSL ONI](https://psl.noaa.gov/data/correlation/oni.data) | Historical temperature index | Missing/future values are not observations |
| [NOAA CO-OPS](https://tidesandcurrents.noaa.gov/) | Gauges and tide predictions | Eight configured stations; station-specific historical availability |
| [UN Comtrade](https://comtradeplus.un.org/) | Annual bilateral merchandise values | Public preview limits, reporting lag, changing country/classification coverage |
| [WTO RTA database](https://rtais.wto.org/UI/PublicAllRTAListAccession.aspx) | Agreements/accessions | Active/inactive lists; current participants are not full historical membership histories |
| [AlphaEarth catalog](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL) | Bundled annual regional overlays | Static derived previews; exact URLs and dates in manifest |
| [Natural Earth](https://www.naturalearthdata.com/) | Country geography | Curated local snapshot |
| [Esri imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) | Satellite-style globe | Provider mosaic dates vary; not time-travel imagery |
| [Esri terrain](https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer) | Elevation | May fall back to ellipsoid if unavailable |
| [FlagCDN](https://flagcdn.com/) | Country flags | External image availability |
| Google Translate widget | Machine translation | Browser language, not nationality; coverage varies by page |

## Water readings

Configured stations: San Francisco, Los Angeles, Honolulu, Key West, The Battery
(New York), Apra Harbor, Pago Pago and San Juan. Values use meters, UTC and the
station's MSL datum. Recent readings can be preliminary. Older selected dates use
hourly heights. Reference observations align a calendar day in the 2023-24 event;
they do not align ENSO phase or demonstrate causation. Astronomical tides exclude
storm and ENSO residuals. No single global water-height prediction is inferred.

## Trade and the timeline

The UI permits 50 years; this is a selection window, not guaranteed coverage.
Queries before 1988 use total merchandise under SITC Rev.1 in this view. Later
queries use HS chapter aggregates: 27 mineral fuels/oils, 10 cereals, 71 precious
stones/metals/jewellery. These are broader than some short UI category labels.
Official annual figures may be compiled/estimated and revised. They do not
identify company contracts or prove transport along a displayed corridor.

## Curated material and unconnected sources

Transport geometry, alliance context, boundaries and AlphaEarth assets are local
snapshots. Selecting a year does not refresh them. EIA/UNCTAD provide context:
[oil chokepoints](https://www.eia.gov/international/analysis/special-topics/world-oil-transit-chokepoints),
[maritime transport](https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport).
[Panama Canal water](https://pancanal.com/en/water/) and
[Copernicus Marine](https://marine.copernicus.eu/) are reference/future-integration
links, not connected global hydrological forecasts.

## Freshness and attribution

Distinguish observation time, source publication time, successful retrieval time
and last attempted update. An HTTP 200 or recent retrieval does not guarantee new
underlying information. For retries/cadences see [DATA-UPDATES.md](../DATA-UPDATES.md).
For rights and required attribution see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
