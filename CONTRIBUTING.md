# Contributing

Thank you for helping improve Global-Trade-El-Nino-Map.

## Before starting

- Read [README.md](README.md), [the architecture](docs/ARCHITECTURE.md),
  [data sources](docs/DATA-SOURCES.md) and [SECURITY.md](SECURITY.md).
- Open an issue for substantial changes. Describe the user problem and coverage.
- Report vulnerabilities privately; do not put exploit details or secrets in issues.

## Local workflow

1. Fork the repository and create a branch for one focused change.
2. Install Node.js >=22.13.0 and run `npm ci`.
3. Use `npm run dev` for a loopback development server.
4. Add meaningful regression tests for data integrity or authorization changes.
5. Run the applicable checks below and open a pull request.

```sh
npx tsc --noEmit --incremental false
node --experimental-strip-types --test tests/snapshot-cache.test.mjs tests/cloudflare-readiness.test.mjs
npm run build
```

`npm run lint` is available, but do not claim it passes unless you ran it. There is
currently no `npm test` script. Do not install a second lockfile/package manager.

## Data and map changes

Provide official source links, publication/retrieval dates, units, datum,
geographic coverage and missing-data behavior. Preserve attribution and licenses.
Never turn missing values into zeroes or forecasts into observations. Annual trade
statistics are not individual deals; alliance membership is not proof of causation.
Keep schematic transport corridors explicitly labeled. AlphaEarth embeddings are
not photographs, water depth or a flood prediction.

## Pull requests

Explain the problem, changed behavior, validation and remaining limitations.
Use dummy fixtures for failures; never load-test public data providers.
Keep database migrations append-only after application. Describe migration and
rollback implications separately from ordinary code rollback.

Do not commit credentials, generated builds, local D1 state or private audit
reports. AI-assisted contributions receive the same review and testing as other
changes. Identify material assumptions and verify generated citations and code.

## License

Submit only material you have the right to contribute. Contributions to original
project code are accepted under the [MIT license](LICENSE). Existing third-party
material retains its own license; see [notices](THIRD_PARTY_NOTICES.md).
