# Minecraft The Sift Tools

Browser-based helpers for choosing The Sift mods, inspecting local Minecraft packages, and following project-specific portal instructions.

**[The Sift tools — use the browser versions](https://minecraftthesift.com/tools/)**

This repository and minecraftthesift.com share the same maintainer. Unofficial; not affiliated with Mojang or Microsoft.

## Run the standalone demo

Use Node.js 22.18 or newer:

```sh
npm ci
npm run demo
```

Open **http://127.0.0.1:5173**. All four helpers run in the demo. No website account, backend, API key or Astro project is needed. The build bundles its dependencies locally; the demo loads no analytics, ads or remote scripts. `PORT=5175 npm run demo` chooses another local port.

## Choose a helper

| Helper | What it does | Browser version / guide |
| --- | --- | --- |
| Compatibility checker | Matches edition, project, Minecraft version and loader to recorded release files. | [The Sift Mod Compatibility Checker](https://minecraftthesift.com/tools/compatibility-checker/) |
| Local file checker | Reads supported JAR, MCPACK and MCADDON metadata in a Worker; compares declarations with your setup. | [The Sift Mod File Checker](https://minecraftthesift.com/tools/file-checker/) |
| Portal finder | Separates each author's entrance instructions from official game availability. | [How to enter The Sift](https://minecraftthesift.com/guides/how-to-enter/) |
| Portal note practice | Checks Mielon's eight-note order and keeps your progress after a wrong note. | [The Sift portal song and note order](https://minecraftthesift.com/mods/mielons-the-sift/portal/) |

The note practice checks order rather than playing audio. For the blocks underneath the instruments, use the [Sonorous Deepslate in Minecraft reference](https://minecraftthesift.com/mods/mielons-the-sift/sonorous-deepslate/).

## Source and data

- `src/`: file parser, compatibility rules, portal lookup and note-sequence logic, plus browser adapters.
- `data/the-sift-projects.json`: six author-identified community projects with release/file links, version/loader pairs, dependency declarations and verification dates.
- `examples/`: standalone HTML, styles and browser entry point.
- `tests/`: metadata, archive limits, version-matching and note-practice tests using synthetic fixtures.
- `docs/`: [data definitions and sources](docs/data-and-sources.md), [local file inspection](docs/file-checker.md), [integration examples](docs/usage.md), and an export hash manifest.

A recorded file pair is a published build match, not a game runtime test. Missing facts stay `null`; ambiguous multi-loader tags stay `unknown`. Each project retains its own `lastVerified` date. The snapshot was exported October 2, 2026; that export does not move source-verification dates forward.

The website project records are the canonical maintenance source. The private site's allowlisted export command copies the JSON and tool modules together and checks their hashes; releases of this repository carry that public snapshot. Corrections should include the original author or file-page URL and the exact affected release. See [data maintenance](docs/data-and-sources.md#maintenance).

## Verify or generate a sample

```sh
npm run verify
npm run fixtures
```

`verify` runs TypeScript checking, the tests and both browser/Worker builds. `fixtures` creates `tests/fixtures/synthetic-fabric.jar` for local upload testing. It contains invented metadata and a text file, not a playable mod. The parser reads selected metadata and never executes JAR code; the file and filename stay in the browser. This is a metadata inspector, not a malware scanner.

## License

Original code, documentation and compiled factual records are [MIT licensed](LICENSE). Mod binaries, game assets and author artwork are not distributed here. Project names identify their respective authors' work. Bundled dependency licenses are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `docs/licenses/`.
