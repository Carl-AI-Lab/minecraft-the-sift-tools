import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { ARCHIVE_LIMITS, inspectFile } from '../src/file-checker.ts';
import { checkMetadataCompatibility } from '../src/compatibility.ts';
const json = (value: unknown) => strToU8(JSON.stringify(value));
const fabric = { schemaVersion: 1, id: 'sample', name: "Mielon's The Sift", version: '1.1.0', authors: [{ name: 'Mielon' }], depends: { minecraft: '26.3', fabricloader: '>=0.19.3', geckolib: '>=5.5.3' } };
const pack = (type: string) => ({ format_version: 2, header: { name: 'Sample Sift', description: 'A test pack', uuid: `uuid-${type}`, version: [0, 3, 0], min_engine_version: [1, 21, 0] }, modules: [{ type, uuid: 'module', version: [0, 3, 0] }], dependencies: [{ uuid: 'dependency-id', version: [1, 0, 0] }] });
function failure(bytes: Uint8Array, name = 'sample.jar', overrides = {}) { const result = inspectFile(bytes, name, { ...ARCHIVE_LIMITS, ...overrides }); assert.equal(result.ok, false); return result.ok ? '' : result.code; }
test('Fabric metadata extracts declarations without executing or inspecting code entries', () => {
  const result = inspectFile(zipSync({ 'fabric.mod.json': json(fabric), 'Example.class': new Uint8Array(20000) }, { level: 0 }), 'local.jar', { ...ARCHIVE_LIMITS, maxExpandedBytes: 2000 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.metadata[0]?.loader, 'fabric');
  assert.deepEqual(result.metadata[0]?.authors, ['Mielon']);
  assert.equal(result.metadata[0]?.minecraft, '26.3');
  assert.ok(result.expandedBytes < 2000);
  assert.equal(checkMetadataCompatibility(result.metadata[0]!, { edition: 'java', minecraftVersion: '26.3', loader: 'forge' }).status, 'incompatible');
  assert.equal(checkMetadataCompatibility(result.metadata[0]!, { edition: 'java', minecraftVersion: '1.21.1', loader: 'fabric' }).status, 'incompatible');
});
for (const [path, loader] of [['META-INF/mods.toml', 'forge'], ['META-INF/neoforge.mods.toml', 'neoforge']]) {
  test(`${loader} TOML preserves Minecraft constraints and dependencies`, () => {
    const result = inspectFile(zipSync({ [path!]: strToU8('modLoader="javafml"\nloaderVersion="[47,)"\n[[mods]]\nmodId="sample"\nversion="1.0"\ndisplayName="Sample"\nauthors="A, B"\n[[dependencies.sample]]\nmodId="minecraft"\nmandatory=true\nversionRange="[1.20.1,1.21)"\n[[dependencies.sample]]\nmodId="geckolib"\nmandatory=true\nversionRange="[4.4.9,)"') }), 'sample.jar');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.metadata[0]?.loader, loader);
    assert.equal(result.metadata[0]?.minecraft, '[1.20.1,1.21)');
    assert.deepEqual(result.metadata[0]?.authors, ['A', 'B']);
  });
}
test('mcaddon selectively reads nested resource and behavior pack manifests', () => {
  const result = inspectFile(zipSync({ 'resource.mcpack': zipSync({ 'manifest.json': json(pack('resources')) }), 'behavior.mcpack': zipSync({ 'manifest.json': json(pack('data')) }) }), 'pair.mcaddon');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.metadata.map((m) => m.packType).sort(), ['Behavior Pack', 'Resource Pack']);
  assert.equal(result.metadata[0]?.version, '0.3.0');
  assert.equal(result.metadata[0]?.minecraft, '>=1.21.0');
});
test('missing metadata, unsupported format and corrupted archive have distinct failures', () => {
  assert.equal(failure(zipSync({ 'notes.txt': strToU8('read me') })), 'unrecognized');
  assert.equal(failure(new Uint8Array([1, 2, 3])), 'corrupt');
  assert.equal(failure(new Uint8Array([1]), 'sample.exe'), 'unsupported');
  assert.equal(failure(zipSync({ 'fabric.mod.json': strToU8('{broken') })), 'corrupt');
});
test('file, entry count and individual metadata limits stop reading', () => {
  const archive = zipSync({ 'fabric.mod.json': json(fabric) });
  assert.equal(failure(archive, 'sample.jar', { maxFileBytes: 1 }), 'limit');
  assert.equal(failure(archive, 'sample.jar', { maxMetadataBytes: 10 }), 'limit');
  assert.equal(failure(zipSync({ a: strToU8('a'), b: strToU8('b') }), 'sample.jar', { maxEntries: 1 }), 'limit');
});
test('compressed bombs and cumulative expansion are rejected before returning metadata', () => {
  assert.equal(failure(zipSync({ 'fabric.mod.json': strToU8(' '.repeat(100000)) }), 'sample.jar', { maxRatio: 10 }), 'limit');
  assert.equal(failure(zipSync({ 'fabric.mod.json': json(fabric) }), 'sample.jar', { maxExpandedBytes: 30 }), 'limit');
});
test('nested package depth is bounded across the entire archive walk', () => {
  const nested = zipSync({ 'child.mcpack': zipSync({ 'manifest.json': json(pack('resources')) }) });
  assert.equal(failure(nested, 'sample.mcaddon', { maxDepth: 0 }), 'limit');
  assert.equal(failure(nested, 'sample.mcaddon', { maxNestedBytes: 10 }), 'limit');
});
test('CRC corruption and encrypted archive declarations cannot masquerade as valid metadata', () => {
  const corrupt = zipSync({ 'fabric.mod.json': json(fabric) }, { level: 0 });
  const view = new DataView(corrupt.buffer, corrupt.byteOffset, corrupt.byteLength);
  for (let i = 0; i + 46 < corrupt.length; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 16, 0, true); break; }
  assert.equal(failure(corrupt), 'corrupt');
  const encrypted = zipSync({ 'fabric.mod.json': json(fabric) });
  const flags = new DataView(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
  for (let i = 0; i + 46 < encrypted.length; i++) if (flags.getUint32(i, true) === 0x02014b50) { flags.setUint16(i + 8, 1, true); break; }
  assert.equal(failure(encrypted), 'unsupported');
});
test('forged small expanded-size claims are checked against actual streamed output', () => {
  const forged = zipSync({ 'fabric.mod.json': strToU8(' '.repeat(40000)) });
  const view = new DataView(forged.buffer, forged.byteOffset, forged.byteLength);
  view.setUint32(22, 10, true);
  for (let i = 0; i + 46 < forged.length; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 10, true); break; }
  assert.equal(failure(forged, 'sample.jar', { maxMetadataBytes: 1000 }), 'limit');
});
test('a JAR version placeholder resolves only from the limited manifest and stays unknown without it', () => {
  const toml = strToU8('modLoader="javafml"\n[[mods]]\nmodId="sample"\nversion="${file.jarVersion}"');
  const without = inspectFile(zipSync({ 'META-INF/mods.toml': toml }), 'sample.jar');
  assert.equal(without.ok, true);
  if (without.ok) assert.equal(without.metadata[0]?.version, null);
  const withManifest = inspectFile(zipSync({ 'META-INF/mods.toml': toml, 'META-INF/MANIFEST.MF': strToU8('Manifest-Version: 1.0\r\nImplementation-Version: 2.4.1\r\n') }), 'sample.jar');
  assert.equal(withManifest.ok, true);
  if (withManifest.ok) assert.equal(withManifest.metadata[0]?.version, '2.4.1');
});
test('an unrelated Java manifest is not expanded for Fabric metadata', () => {
  const archive = zipSync({ 'fabric.mod.json': json(fabric), 'META-INF/MANIFEST.MF': strToU8('a'.repeat(1000)) }, { level: 0 });
  assert.equal(inspectFile(archive, 'sample.jar', { ...ARCHIVE_LIMITS, maxMetadataBytes: 500 }).ok, true);
});
test('many supported metadata records are bounded before reaching the UI', () => {
  const entries = Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`pack${index}/manifest.json`, json(pack('resources'))]));
  assert.equal(failure(zipSync(entries), 'sample.mcpack'), 'limit');
});
