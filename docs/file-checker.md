# The Sift Mod File Checker

[The Sift Mod File Checker in your browser](https://minecraftthesift.com/tools/file-checker/) reads a package's declared edition, loader, Minecraft constraint and dependencies. Select a local file in the standalone demo to use the same parser.

Fabric JSON, Forge/NeoForge TOML and Bedrock manifests are supported. Nested MCPACK/MCADDON manifests are inspected within the bounds below. JAR classes and unrelated textures are not expanded or executed.

| Limit | Value |
| --- | --- |
| Input file | 64 MiB |
| Cumulative archive entries | 4,096 |
| Nested depth | 3 |
| Individual metadata file | 256 KiB |
| Nested package | 16 MiB |
| Total selected expansion | 24 MiB |
| Compression ratio | 160:1 |
| Metadata records | 128 |

The parser checks archive bounds, local-header agreement, actual expanded sizes and CRC. Encrypted, split and ZIP64 archives are unsupported. Result codes distinguish `corrupt`, `unrecognized`, `unsupported` and `limit`. These are parsing outcomes, not malware verdicts.

The browser transfers the selected bytes to a same-origin module Worker. Clear or a new selection terminates the old Worker; an eight-second timeout bounds processing. It does not send the file, filename or parsed metadata to a server. Metadata is rendered as text. A matching author/name or known project URL produces a project candidate, not authenticated provenance.

For a synthetic input, run `npm run fixtures` and select `tests/fixtures/synthetic-fabric.jar`. Its Minecraft declaration is `1.21.1`, loader Fabric, author Example Author. There is no game code in this fixture.
