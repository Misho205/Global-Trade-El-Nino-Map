# Video analysis and research implementation

Video: https://www.youtube.com/watch?v=VKdDaatMeGo
Reviewed 2026-11-10 through timestamped English captions (approximately 19m26s). Visual figures and on-screen references were not independently audited. Captions can contain errors; the transcript is not redistributed here. Narration is a research lead, never a measurement feed or forecast input.

## Claims and evidence

- 00:00–03:20: ENSO, 1997 comparisons, precipitation and cyclone context. The existing NOAA outlook/ONI remain available; SOI is now connected. NASA's dated 1997/2026 sea-height comparison is a verified reference, not a connected numerical grid or a prediction of local water depth.
- 03:20–05:50: sea level, thermal expansion and water loading. Sea-surface height combines steric and mass effects; it cannot directly supply ocean-bottom pressure or fault stress. Tide-gauge datum, wave height and GRACE equivalent water height are different quantities.
- 05:50–08:45: California seasonal loading/seismicity. Primary reference: Johnson, Fu & Bürgmann (2017), DOI https://doi.org/10.1126/science.aak9547 (bibliography: https://pubmed.ncbi.nlm.nih.gov/28619942/). This regional study does not validate a global ENSO earthquake predictor.
- 08:45–12:15: East Pacific Rise/Easter microplate association and lags. The described 2010 paper lacks a verified full citation in this review. Do not implement its claimed lag as an operational rule or infer causation from the narrative.
- 12:15–15:20: IOD and compound drought. DMI is now connected. Historical context: Singh et al. (2018), https://www.giss.nasa.gov/pubs/abs/si00300e.html. A scalar index does not forecast crop losses, famine or shipment disruption.
- 15:20–19:26: altered background climate and possible seasonal seismic research. The particular 2026 teleconnection paper needs bibliographic verification. Historical analogues require compatible datasets and attribution; no earthquake forecast is implemented.

USGS prediction guidance: https://www.usgs.gov/faqs/can-you-predict-earthquakes
NASA comparison: https://science.nasa.gov/earth/earth-observatory/el-nino-then-and-now/

## Implemented data and map changes

/api/research?source=earthquakes reads the USGS M2.5+ rolling-day feed. Past date queries use the FDSN catalog for one UTC calendar day, with a 1,000-result cap and magnitude floor 2.5. Dates are validated from 1950 through today; catalog completeness is not guaranteed over that period. Event status, magnitude type, depth and update time are retained. The tsunami field is not treated as an official tsunami warning.

source=buoys reads latest NOAA NDBC observations. MM remains null, not zero. Wind/gust are m/s; significant wave height is meters. Buoys remain latest-only when the earthquake timeline moves into the past. source=dmi and source=soi read monthly NOAA PSL tables, preserving missing sentinels as null. DMI is the HadISST anomaly-gradient product; SOI uses the published CPC scale. Do not mix these with differently normalized series, daily forecasts or ONI/RONI.

The existing globe supports opt-in earthquake and buoy points. /research combines that globe with source status, index comparison, normalized JSON export and nearby marine observations. Each layer renders at most 1,500 points; exports retain all validated returned records. Exports include source URLs, units, timestamps, query, quality/cap indicators and SHA-256 fingerprints of decoded UTF-8 source text and the normalized record array. They are analysis snapshots, not an immutable server archive or a substitute for product DOI/version citation. Record the released processing-code revision for formal reproducibility; this checkout contains uncommitted work.

Marine screening finds observations within 150 km of great-circle corridor segments, no more than three hours old with 15-minute clock tolerance. Visible example thresholds are wind >=15 m/s or waves >=4 m; they are not vessel operating limits. Stale/unavailable feeds are excluded from current screening. Missing coverage means unknown, never safe. No route ranking, ETA, fuel optimum, earthquake/tsunami prediction or navigational clearance is generated. Cargo labels do not establish an actual shipment, including gold or petrol.

## Still required for the requested professional uses

Versioned sea-height/SST/current/wave forecasts, GRACE uncertainty, precipitation, GNSS deformation, official marine/tsunami warnings, licensed hydrographic charts, vessel draft/performance/cargo constraints, port/canal restrictions and security feeds are not connected by these additions. Reference cards label these gaps explicitly.

Before a causal seismic analysis: validate citations, source uncertainty and sampling, catalog completeness, magnitude scales, declustering, fault orientation/stress model, confounding and multiple testing; test models out of sample. Before operational rerouting: independently validate metocean models against observations/voyages and integrate vessel-specific safety constraints and human approval. No scientific-grade certification or operational routing readiness is claimed.