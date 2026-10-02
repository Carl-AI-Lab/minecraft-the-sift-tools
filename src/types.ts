export type Edition = 'java' | 'bedrock' | 'dungeons';
export type Loader = 'fabric' | 'forge' | 'neoforge' | 'bedrock';
export interface Dependency { name: string; requirement: string | null; optional: boolean }
export interface Release {
  id: string; minecraftVersions: string[]; loaders: Loader[]; modVersion: string | null;
  filename: string | null; downloadUrl: string; dependencies: Dependency[] | null;
  evidence: 'file-page' | 'publisher-tags'; notes: string | null;
}
export interface Project {
  id: string; name: string; author: string; projectId: string; edition: 'java' | 'bedrock';
  projectUrl: string; metadataIds: string[] | null; releases: Release[];
  portal: { status: 'documented' | 'unverified'; type: string; instructions: string; guideUrl: string };
  lastVerified: string;
}
export interface Environment { edition: Edition; minecraftVersion: string; loader: Loader | null }
export type MatchStatus = 'compatible' | 'incompatible' | 'unknown';
export interface CompatibilityResult { status: MatchStatus; reason: string; releases: Release[]; alternatives: { project: Project; release: Release }[] }
export interface FileMetadata {
  path: string; edition: 'java' | 'bedrock'; loader: Loader; name: string; id: string | null;
  version: string | null; authors: string[]; minecraft: string | null; dependencies: Dependency[] | null;
  description: string | null; packType: string | null; projectUrls: string[];
}
export type FileFailure = 'corrupt' | 'unrecognized' | 'unsupported' | 'limit';
export type FileInspection = { ok: true; metadata: FileMetadata[]; expandedBytes: number; entries: number }
  | { ok: false; code: FileFailure; message: string };
