# Use the modules

Install the dependencies with `npm ci`. The TypeScript files can be imported by a browser bundler or, on Node.js 22.18+, used by the tests with built-in type stripping.

## Match a published file

```ts
import { projects } from '../src/database.ts';
import { findCompatibility } from '../src/compatibility.ts';

const result = findCompatibility(projects, 'mielon', {
  edition: 'java', minecraftVersion: '26.3', loader: 'fabric',
});
console.log(result.status, result.releases.map(file => file.downloadUrl));
```

The result is `compatible`, `incompatible` or `unknown`. For download selection and branch requirements, use [The Sift Mod Compatibility Checker](https://minecraftthesift.com/tools/compatibility-checker/).

## Read package declarations

```ts
import { inspectFile } from '../src/file-checker.ts';
const result = inspectFile(new Uint8Array(arrayBuffer), 'local.jar');
```

Run inspection in a Worker for browser UI. Build `src/file-worker.ts` to `file-worker.js` next to the browser bundle, as `scripts/build.mjs` does. See the [file inspection limits](file-checker.md).

## Rehearse Mielon's note order

```ts
import { resetNotes, playNote } from '../src/note-sequence.ts';
let state = resetNotes();
state = playNote(state, 1);
state = playNote(state, 3);
```

Incorrect notes retain completed progress. Reset returns to the first note. The [The Sift portal song and note order guide](https://minecraftthesift.com/mods/mielons-the-sift/portal/) explains the actual game setup; these modules do not operate Minecraft.

## Browser integration

`examples/index.html` carries the four `data-*-tool` roots and native control names consumed by the browser adapters. `examples/main.ts` loads them independently. The CSS reuses the website's approved colors, follows system dark appearance and needs no UI framework. Static source links and the note sequence remain readable with JavaScript disabled.
