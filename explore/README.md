# Tweet explorer source code

This directory contains the React/Vite application used by the [Democracy Tweets Browser](https://gyuhoshin.github.io/democracy-tweet-browser/).

## Run locally

From this directory, with Node.js 22.12 or newer installed:

```sh
npm ci
npm run dev
```

## Build and preview

```sh
npm run build
npm run preview
```

The build is written to `dist/`. To update the existing GitHub Pages site, publish the contents of `explore/dist/` to the `gh-pages` branch.

## Data location

CSV files are maintained in the repository's [data/](../data/) directory. Vite uses `../data` as its public directory, serves those files at the site root during development, and includes unchanged copies in the build. This preserves the CSV URLs used by the explorer without duplicating data in the source tree.

Source files, dependency manifests, and application configuration are all kept in this directory. The repository root README describes the research dataset.
