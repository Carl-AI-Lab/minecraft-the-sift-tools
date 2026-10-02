import { zipSync, strToU8 } from 'fflate';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('tests/fixtures', { recursive: true });
const metadata = { schemaVersion: 1, id:'synthetic_example', name:'Synthetic Example', version:'1.0.0', authors:['Example Author'], depends:{ minecraft:'1.21.1', fabricloader:'>=0.16.0' } };
await writeFile('tests/fixtures/synthetic-fabric.jar', zipSync({ 'fabric.mod.json':strToU8(JSON.stringify(metadata)), 'README.txt':strToU8('Synthetic archive, not a mod. No game code.') }));
console.log('Created synthetic-fabric.jar: metadata-only test fixture, not a real mod.');
