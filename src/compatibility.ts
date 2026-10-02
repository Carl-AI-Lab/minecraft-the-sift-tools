import type { CompatibilityResult, Environment, FileMetadata, MatchStatus, Project, Release } from './types.ts';

export function findCompatibility(projects: Project[], projectId: string, environment: Environment): CompatibilityResult {
  const fits = (project: Project, release: Release) => project.edition === environment.edition
    && release.minecraftVersions.includes(environment.minecraftVersion.trim())
    && (environment.edition === 'bedrock' || (environment.loader !== null && release.loaders.includes(environment.loader)));
  const alternatives = projects.flatMap((project) => project.releases
    .filter((release) => release.evidence === 'file-page' && fits(project, release)).map((release) => ({ project, release })));
  const project = projects.find((value) => value.id === projectId);
  if (!project) return { status: 'unknown', reason: 'Official games have separate release and entry rules. See current availability; a community mod is not an official game build.', releases: [], alternatives: [] };
  if (project.edition !== environment.edition) return { status: 'incompatible', reason: `This is a ${project.edition === 'java' ? 'Java mod' : 'Bedrock add-on'}, so it does not match your selected edition.`, releases: [], alternatives };
  const releases = project.releases.filter((release) => fits(project, release));
  if (releases.some((release) => release.evidence === 'file-page')) return { status: 'compatible', reason: 'A published file matches this Minecraft version and loader. Check its listed dependencies and the author’s current instructions before installing.', releases, alternatives: [] };
  return { status: 'unknown', reason: releases.length ? 'The publisher tags this file for multiple loaders; its binary compatibility has not been independently verified.' : 'No verified matching build found. No matching file has been verified by this site; this does not mean the project cannot support your setup.', releases, alternatives };
}

const numericVersion = /^\d+(?:\.\d+)*$/;
function compare(left: string, right: string): number {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
export function matchesVersion(version: string, constraint: string | null): MatchStatus {
  if (!constraint || !numericVersion.test(version.trim())) return 'unknown';
  const rule = constraint.trim();
  if (rule === '*') return 'compatible';
  if (rule.includes('||')) {
    const states = rule.split('||').map((part) => matchesVersion(version, part));
    return states.includes('compatible') ? 'compatible' : states.includes('unknown') ? 'unknown' : 'incompatible';
  }
  const interval = rule.match(/^([[(])\s*(\d+(?:\.\d+)*)?\s*,\s*(\d+(?:\.\d+)*)?\s*([)\]])$/);
  if (interval) {
    const lower = interval[2], upper = interval[3];
    const matches = (!lower || (interval[1] === '[' ? compare(version, lower) >= 0 : compare(version, lower) > 0))
      && (!upper || (interval[4] === ']' ? compare(version, upper) <= 0 : compare(version, upper) < 0));
    return matches ? 'compatible' : 'incompatible';
  }
  const wildcard = rule.match(/^(\d+(?:\.\d+)*)\.(?:x|\*)$/i);
  if (wildcard) return version === wildcard[1] || version.startsWith(`${wildcard[1]}.`) ? 'compatible' : 'incompatible';
  const exactRange = rule.match(/^\[(\d+(?:\.\d+)*)\]$/);
  if (exactRange) return compare(version, exactRange[1]!) === 0 ? 'compatible' : 'incompatible';
  const tokens = rule.split(/\s+/);
  if (tokens.some((token) => !/^(?:>=|<=|>|<|=)?\d+(?:\.\d+)*$/.test(token))) return 'unknown';
  return tokens.every((token) => {
    const match = token.match(/^(>=|<=|>|<|=)?(.+)$/)!;
    const difference = compare(version, match[2]!);
    return match[1] === '>=' ? difference >= 0 : match[1] === '<=' ? difference <= 0
      : match[1] === '>' ? difference > 0 : match[1] === '<' ? difference < 0 : difference === 0;
  }) ? 'compatible' : 'incompatible';
}
export function checkMetadataCompatibility(metadata: FileMetadata, environment: Environment): { status: MatchStatus; reason: string } {
  if (metadata.edition === 'java' && environment.edition === 'java' && environment.loader === null) return { status: 'unknown', reason: 'Select your Java loader before comparing this file’s declarations.' };
  if (metadata.edition !== environment.edition || (metadata.edition === 'java' && metadata.loader !== environment.loader)) return { status: 'incompatible', reason: 'This metadata declares a different edition or loader from your setup.' };
  const status = matchesVersion(environment.minecraftVersion, metadata.minecraft);
  return { status, reason: status === 'compatible' ? 'The metadata’s version and loader declarations match. This does not verify file authenticity, safety, dependencies, or runtime behavior.' : status === 'incompatible' ? 'The Minecraft version does not satisfy this file’s metadata constraint.' : 'The version constraint is missing or not supported by this checker. No compatibility conclusion can be verified.' };
}
export function identifyProject(metadata: FileMetadata, projects: Project[]): Project | undefined {
  const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, '').trim();
  return projects.find((project) => project.edition === metadata.edition && (
    metadata.projectUrls.some((url) => url.replace(/\/$/, '') === project.projectUrl)
    || (normalize(metadata.name) === normalize(project.name) && metadata.authors.some((author) => normalize(author) === normalize(project.author)))
  ));
}
