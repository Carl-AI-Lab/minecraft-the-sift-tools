import test from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/database.ts';
import { findCompatibility, matchesVersion, checkMetadataCompatibility, identifyProject } from '../src/compatibility.ts';
import type { FileMetadata } from '../src/types.ts';

const fabric: FileMetadata = { path: 'fabric.mod.json', edition: 'java', loader: 'fabric', name: "Mielon's The Sift", id: 'test_id', version: '1.1.0', authors: ['Mielon'], minecraft: '26.3', dependencies: null, description: null, packType: null, projectUrls: [] };
test('verified file pairs match without creating a version and loader cross product', () => {
  assert.equal(findCompatibility(projects, 'mielon', { edition: 'java', minecraftVersion: '26.3', loader: 'fabric' }).status, 'compatible');
  assert.equal(findCompatibility(projects, 'mielon', { edition: 'java', minecraftVersion: '26.3', loader: 'forge' }).status, 'unknown');
  assert.equal(findCompatibility(projects, 'mielon', { edition: 'bedrock', minecraftVersion: '26.50', loader: 'bedrock' }).status, 'incompatible');
});
test('unknown versions and ambiguous publisher loader tags do not mean verified compatibility', () => {
  assert.equal(findCompatibility(projects, 'zerw', { edition: 'java', minecraftVersion: '1.21.1', loader: 'forge' }).status, 'unknown');
  assert.equal(findCompatibility(projects, 'mielon', { edition: 'java', minecraftVersion: '99.0', loader: 'fabric' }).status, 'unknown');
});
test('a specific local metadata loader or version conflict is explicitly incompatible', () => {
  assert.equal(checkMetadataCompatibility(fabric, { edition: 'java', minecraftVersion: '26.3', loader: 'neoforge' }).status, 'incompatible');
  assert.equal(checkMetadataCompatibility(fabric, { edition: 'java', minecraftVersion: '1.21.1', loader: 'fabric' }).status, 'incompatible');
  assert.equal(checkMetadataCompatibility(fabric, { edition: 'java', minecraftVersion: '26.3', loader: 'fabric' }).status, 'compatible');
});
test('an unspecified Java loader is unknown rather than a proven mismatch', () => {
  assert.equal(checkMetadataCompatibility(fabric, { edition: 'java', minecraftVersion: '26.3', loader: null }).status, 'unknown');
});
test('version predicates support exact, simple comparator, Maven interval and wildcard declarations conservatively', () => {
  assert.equal(matchesVersion('1.21.1', '[1.21,1.22)'), 'compatible');
  assert.equal(matchesVersion('1.22', '[1.21,1.22)'), 'incompatible');
  assert.equal(matchesVersion('26.3', '>=26.2 <27'), 'compatible');
  assert.equal(matchesVersion('1.21.1', '1.20.x'), 'incompatible');
  assert.equal(matchesVersion('26.3', '${minecraft_version}'), 'unknown');
  assert.equal(matchesVersion('26.3', null), 'unknown');
});
test('known projects need identifying metadata and never rely on a generic mod ID alone', () => {
  assert.equal(identifyProject(fabric, projects)?.id, 'mielon');
  assert.equal(identifyProject({ ...fabric, name: 'The Sift', authors: [] }, projects), undefined);
});
test('all six shared records carry provenance and unknown dependencies remain null', () => {
  assert.deepEqual(projects.map((p) => p.id), ['mielon', 'wellspring', 'zerw', 'derexxd', 'trotamundos', 'korvvvik']);
  for (const project of projects) {
    assert.ok(project.author && project.projectUrl.startsWith('https://www.curseforge.com/') && project.lastVerified);
    assert.ok(project.releases.every((release) => release.minecraftVersions.length > 0 && release.loaders.length > 0));
  }
  assert.equal(projects.find((p) => p.id === 'wellspring')?.releases[0]?.dependencies, null);
});
