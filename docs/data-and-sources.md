# Project records: definitions and sources

Use each `releases[]` entry as a single published file record. Keep its `minecraftVersions`, `loaders` and `downloadUrl` together; joining every project-wide version to every loader creates combinations the author may never have released.

| Field | Meaning |
| --- | --- |
| `id` | Stable local project key; not a registered Minecraft item/mod ID. |
| `projectId`, `author`, `projectUrl` | Publisher identity and original project page. |
| `metadataIds` | Known package IDs, or `null` when not verified. A generic ID alone does not authenticate a project. |
| `releases[].id` | Original publisher file ID. |
| `evidence: file-page` | Recorded version/loader association from a specific file page. |
| `evidence: publisher-tags` | Publisher tags retained as claims; the checker does not mark these as verified binary compatibility. |
| `dependencies: null` | Requirements not verified for that file. |
| `dependencies: []` | Explicitly verified empty list; not interchangeable with `null`. |
| `portal.status` | Whether this author's entrance instructions have been documented. |
| `portal.guideUrl` | Author page or website guide. Root-relative paths resolve against `https://minecraftthesift.com`, including in the standalone demo. |
| `lastVerified` | The recorded source-review date for that project, not the export or download date. |

## Source coverage

The current snapshot contains six distinct community projects. Author names distinguish similarly named projects:

| Project / author | Primary project source | Recorded review |
| --- | --- | --- |
| Mielon's The Sift / Mielon | [CurseForge project 1691925](https://www.curseforge.com/minecraft/mc-mods/mielons-the-sift) | 2026-10-01 |
| Wellspring / SyddersLMAO | [Wellspring on CurseForge](https://www.curseforge.com/minecraft/mc-mods/wellspring) | 2026-09-30 |
| The Sift: Backport / Zerw | [Zerw's backport](https://www.curseforge.com/minecraft/mc-mods/the-sift-backport-0) | 2026-09-30 |
| Sift Backport / DerexXD | [DerexXD's backport](https://www.curseforge.com/minecraft/mc-mods/sift-backport) | 2026-10-01 |
| The Sift Dimension Add-On / trotamundos872 | [trotamundos872's add-on](https://www.curseforge.com/minecraft-bedrock/addons/the-sift) | 2026-09-30 |
| The Sift Dimension Addon / Korvvvik | [Korvvvik's add-on](https://www.curseforge.com/minecraft-bedrock/addons/the-sift-dimension-addon) | 2026-09-30 |

Individual release URLs and file notes are in the JSON. Some dependencies and Bedrock pack pairings remain unverified; use the author's file list before installing. This snapshot lists recorded files, rather than every file an author has ever released. Official availability is a separate route in the browser adapters, dated September 30, 2026; it is not a community release record.

The maintainer compiles the records from publisher project/file pages and writes the comparison rules. Archive and note tests use self-made inputs. No game performance or installation test is asserted by these records.

## Maintenance

The website owns the source JSON. Its `node scripts/sync-public-tools.mjs` command exports only an explicit list of public tool modules, tests and that JSON into this working copy. `--check` detects drift without writing. `docs/export-manifest.json` records SHA-256 hashes before and after the four portability adapters: flattened imports, absolute website links, compiled Worker filename, and test import paths.

When a source record changes, export the whole tool snapshot, run `npm ci && npm run verify`, review the public diff, and publish the updated repository. Do not manually advance `lastVerified` because a build or export ran. A website update alone does not prove that GitHub's copy was published; check the public commit separately.
