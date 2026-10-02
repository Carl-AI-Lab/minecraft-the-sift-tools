import { Inflate } from 'fflate';
import { parse as parseToml } from 'smol-toml';
import type { Dependency, FileFailure, FileInspection, FileMetadata } from './types.ts';
export interface ArchiveLimits { maxFileBytes: number; maxEntries: number; maxDepth: number; maxMetadataBytes: number; maxNestedBytes: number; maxExpandedBytes: number; maxRatio: number }
export const ARCHIVE_LIMITS: ArchiveLimits = { maxFileBytes: 64 * 1024 * 1024, maxEntries: 4096, maxDepth: 3, maxMetadataBytes: 256 * 1024, maxNestedBytes: 16 * 1024 * 1024, maxExpandedBytes: 24 * 1024 * 1024, maxRatio: 160 };
class ArchiveError extends Error {
  code: FileFailure;
  constructor(code: FileFailure, message: string) { super(message); this.code = code; }
}
const reject = (code: FileFailure, message: string): never => { throw new ArchiveError(code, message); };
const decode = new TextDecoder('utf-8', { fatal: true });
interface Entry { name: string; method: number; packed: number; expanded: number; crc: number; dataOffset: number }
interface Budget { entries: number; expanded: number }

// Read directory declarations before any decompression. Never materialize unrelated entries.
function directory(bytes: Uint8Array, limits: ArchiveLimits, budget: Budget): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break; }
  }
  if (end < 0) return reject('corrupt', 'The ZIP directory is missing or truncated.');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (count === 65535 || size === 0xffffffff || start === 0xffffffff) return reject('unsupported', 'ZIP64 packages are not supported.');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count) return reject('unsupported', 'Split ZIP archives are not supported.');
  if (start + size !== end) return reject('corrupt', 'The archive directory bounds are inconsistent.');
  budget.entries += count;
  if (budget.entries > limits.maxEntries) return reject('limit', 'The archive contains too many entries.');
  const entries: Entry[] = [], names = new Set<string>();
  let offset = start;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) return reject('corrupt', 'A ZIP directory entry is malformed.');
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const packed = view.getUint32(offset + 20, true), expanded = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true), extraSize = view.getUint16(offset + 30, true), commentSize = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (flags & 1) return reject('unsupported', 'Encrypted archives cannot be inspected.');
    if (method !== 0 && method !== 8) return reject('unsupported', 'This archive uses an unsupported compression method.');
    if (packed === 0xffffffff || expanded === 0xffffffff || local === 0xffffffff) return reject('unsupported', 'ZIP64 entries are not supported.');
    if (offset + 46 + nameSize + extraSize + commentSize > end || local + 30 > start) return reject('corrupt', 'A ZIP entry points outside the archive.');
    const name = decode.decode(bytes.subarray(offset + 46, offset + 46 + nameSize));
    if (!name || names.has(name) || name.includes('\0') || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..')) return reject('corrupt', 'The archive contains ambiguous entry names.');
    names.add(name);
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method || view.getUint16(local + 6, true) !== flags) return reject('corrupt', 'Local and central ZIP headers disagree.');
    const localNameSize = view.getUint16(local + 26, true), localExtraSize = view.getUint16(local + 28, true);
    const dataOffset = local + 30 + localNameSize + localExtraSize;
    if (dataOffset + packed > start || decode.decode(bytes.subarray(local + 30, local + 30 + localNameSize)) !== name) return reject('corrupt', 'Local ZIP entry bounds or names are invalid.');
    if (expanded > Math.max(1, packed) * limits.maxRatio) return reject('limit', 'An entry exceeds the allowed compression ratio.');
    entries.push({ name, method, packed, expanded, crc: view.getUint32(offset + 16, true), dataOffset });
    offset += 46 + nameSize + extraSize + commentSize;
  }
  if (offset !== end) return reject('corrupt', 'The directory size does not match its entries.');
  return entries;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function extract(bytes: Uint8Array, entry: Entry, cap: number, limits: ArchiveLimits, budget: Budget): Uint8Array {
  if (entry.expanded > cap || budget.expanded + entry.expanded > limits.maxExpandedBytes) return reject('limit', 'The metadata or total expansion limit was exceeded.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  const accept = (chunk: Uint8Array) => {
    length += chunk.length;
    budget.expanded += chunk.length;
    if (length > cap || budget.expanded > limits.maxExpandedBytes || length > Math.max(1, entry.packed) * limits.maxRatio) return reject('limit', 'Actual decompressed output exceeded a safety limit.');
    chunks.push(chunk);
  };
  const packed = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.packed);
  if (entry.method === 0) accept(packed);
  else {
    const stream = new Inflate((chunk) => accept(chunk));
    // Small compressed pushes bound the allocation before each output callback.
    for (let offset = 0; offset < packed.length; offset += 256) stream.push(packed.subarray(offset, offset + 256), offset + 256 >= packed.length);
    if (packed.length === 0) return reject('corrupt', 'A deflated entry is empty.');
  }
  if (length !== entry.expanded) return reject('corrupt', 'The decompressed size does not match its declaration.');
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  if (crc32(result) !== entry.crc) return reject('corrupt', 'The metadata checksum does not match.');
  return result;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim().slice(0, 4000) : null;
const version = (value: unknown): string | null => Array.isArray(value) && value.every((part) => Number.isInteger(part) && Number(part) >= 0) ? value.join('.') : text(value);
const declaredVersion = (value: unknown) => { const result = version(value); return result?.includes('${') ? null : result; };
const authors = (value: unknown): string[] => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((value) => text(value) ?? text(object(value).name)).filter((value): value is string => value !== null);
const constraint = (value: unknown): string | null => Array.isArray(value) && value.every((part) => typeof part === 'string') ? value.join(' || ') : text(value);
function base(path: string): FileMetadata { return { path, edition: 'java', loader: 'fabric', name: 'Unnamed package', id: null, version: null, authors: [], minecraft: null, dependencies: null, description: null, packType: null, projectUrls: [] }; }
function metadata(path: string, content: string, jarVersion: string | null): FileMetadata[] {
  if (path.endsWith('fabric.mod.json')) {
    const data = object(JSON.parse(content));
    if (!text(data.id)) return reject('unrecognized', 'Fabric metadata does not identify a mod.');
    const depends = object(data.depends), contacts = object(data.contact);
    return [{ ...base(path), id: text(data.id), name: text(data.name) ?? text(data.id)!, version: declaredVersion(data.version), authors: authors(data.authors), minecraft: constraint(depends.minecraft),
      dependencies: data.depends === undefined ? null : Object.entries(depends).map(([name, value]) => ({ name, requirement: constraint(value), optional: false })), description: text(data.description), projectUrls: Object.values(contacts).filter((value): value is string => typeof value === 'string' && value.startsWith('https://')) }];
  }
  if (path.endsWith('.toml')) {
    const data = object(parseToml(content)), mods = Array.isArray(data.mods) ? data.mods : [];
    if (!mods.length) return reject('unrecognized', 'The TOML file does not list recognizable mods.');
    if (mods.length > 128) return reject('limit', 'Too many mod records are declared.');
    return mods.map((value) => {
      const mod = object(value), id = text(mod.modId), allDependencies = object(data.dependencies);
      const declared = id ? allDependencies[id] : undefined;
      const dependencies = Array.isArray(declared) ? declared.map((value) => object(value)) : null;
      return { ...base(path), loader: path.endsWith('neoforge.mods.toml') ? 'neoforge' : 'forge', id, name: text(mod.displayName) ?? id ?? 'Unnamed mod',
        version: declaredVersion(mod.version) ?? (mod.version === '${file.jarVersion}' ? jarVersion : null), authors: authors(mod.authors),
        minecraft: text(dependencies?.find((dependency) => dependency.modId === 'minecraft')?.versionRange),
        dependencies: dependencies?.map((dependency): Dependency => ({ name: text(dependency.modId) ?? 'Unknown dependency', requirement: text(dependency.versionRange), optional: dependency.mandatory === false || dependency.type === 'optional' })) ?? null,
        description: text(mod.description), projectUrls: [text(mod.displayURL), text(data.issueTrackerURL)].filter((value): value is string => !!value) };
    });
  }
  const data = object(JSON.parse(content)), header = object(data.header), modules = Array.isArray(data.modules) ? data.modules.map(object) : [];
  if (!text(header.uuid) || !modules.length) return reject('unrecognized', 'The Bedrock manifest is missing a pack identity or modules.');
  const resource = modules.some((module) => module.type === 'resources'), behavior = modules.some((module) => module.type === 'data' || module.type === 'script');
  const minimum = version(header.min_engine_version);
  return [{ ...base(path), edition: 'bedrock', loader: 'bedrock', name: text(header.name) ?? 'Unnamed pack', id: text(header.uuid), version: declaredVersion(header.version), authors: authors(object(data.metadata).authors), minecraft: minimum ? `>=${minimum}` : null, description: text(header.description),
    packType: resource && behavior ? 'Resource + Behavior Pack' : resource ? 'Resource Pack' : behavior ? 'Behavior Pack' : 'Unknown pack type',
    dependencies: Array.isArray(data.dependencies) ? data.dependencies.map((value): Dependency => { const dependency = object(value); return { name: text(dependency.uuid) ?? text(dependency.module_name) ?? 'Unknown dependency', requirement: version(dependency.version), optional: false }; }) : null }];
}

export function inspectFile(bytes: Uint8Array, filename: string, limits: ArchiveLimits = ARCHIVE_LIMITS): FileInspection {
  try {
    if (!/\.(jar|mcpack|mcaddon)$/i.test(filename)) return reject('unsupported', 'Choose a .jar, .mcpack or .mcaddon file.');
    if (bytes.length > limits.maxFileBytes) return reject('limit', 'The file exceeds the 64 MiB inspection limit.');
    const budget: Budget = { entries: 0, expanded: 0 }, found: FileMetadata[] = [];
    const java = /\.jar$/i.test(filename);
    function walk(archive: Uint8Array, depth: number, prefix: string): void {
      if (depth > limits.maxDepth) return reject('limit', 'Nested package depth exceeds the inspection limit.');
      const entries = directory(archive, limits, budget);
      const javaMetadata = new Set(['fabric.mod.json', 'META-INF/mods.toml', 'META-INF/neoforge.mods.toml']);
      const selected = entries.filter((entry) => java ? javaMetadata.has(entry.name) : /(^|\/)manifest\.json$/i.test(entry.name));
      let jarVersion: string | null = null;
      let manifestRead = false;
      const manifest = java && entries.find((entry) => entry.name === 'META-INF/MANIFEST.MF');
      for (const entry of selected) {
        const content = decode.decode(extract(archive, entry, limits.maxMetadataBytes, limits, budget));
        if (manifest && !manifestRead && entry.name.endsWith('.toml') && content.includes('${file.jarVersion}')) {
          const value = decode.decode(extract(archive, manifest, limits.maxMetadataBytes, limits, budget));
          jarVersion = declaredVersion(value.match(/^Implementation-Version:\s*(.+)$/m)?.[1]);
          manifestRead = true;
        }
        const records = metadata(prefix + entry.name, content, jarVersion);
        if (found.length + records.length > 128) return reject('limit', 'The archive declares too many metadata records.');
        found.push(...records);
      }
      if (!java) for (const entry of entries.filter((entry) => /\.(mcpack|mcaddon)$/i.test(entry.name))) {
        if (depth >= limits.maxDepth) return reject('limit', 'Nested package depth exceeds the inspection limit.');
        walk(extract(archive, entry, limits.maxNestedBytes, limits, budget), depth + 1, `${prefix}${entry.name}/`);
      }
    }
    walk(bytes, 0, '');
    if (!found.length) return reject('unrecognized', 'No supported Fabric, Forge, NeoForge or Bedrock metadata was found.');
    return { ok: true, metadata: found, expandedBytes: budget.expanded, entries: budget.entries };
  } catch (error) {
    return error instanceof ArchiveError ? { ok: false, code: error.code, message: error.message }
      : { ok: false, code: 'corrupt', message: 'The archive or its metadata could not be parsed. It may be truncated or malformed.' };
  }
}
