import { projects } from './database.ts';
import { findCompatibility } from './compatibility.ts';
import { element, facts, link, ready } from './dom.ts';
import type { Edition, Environment, Loader, Project, Release } from './types.ts';

function releaseCard(project: Project, release: Release): HTMLElement {
  const card = element('article');
  card.append(element('h3', `${project.name} · ${release.modVersion ?? 'Version not verified'}`));
  card.append(facts([['Minecraft', release.minecraftVersions.join(', ')], ['Loader / package', release.loaders.join(', ')], ['Author', project.author], ['File', release.filename ?? 'See author’s file page'], ['Last verified', project.lastVerified]]));
  card.append(element('p', release.dependencies === null ? 'Dependencies: not yet verified. Check this exact file on the author’s page.' : `Dependencies: ${release.dependencies.map((dependency) => `${dependency.name}${dependency.requirement ? ` ${dependency.requirement}` : ''}${dependency.optional ? ' (optional)' : ''}`).join('; ') || 'None declared in the verified source.'}`));
  card.append(element('p', `${project.portal.type}: ${project.portal.instructions}`));
  if (release.notes) card.append(element('p', release.notes, 'tool-help'));
  const actions = element('p', undefined, 'tool-actions');
  actions.append(link('Author’s file page ↗', release.downloadUrl), link('Project page ↗', project.projectUrl), link('Portal / entry guide →', project.portal.guideUrl));
  card.append(actions);
  return card;
}
ready(() => document.querySelectorAll<HTMLElement>('[data-compatibility-tool]').forEach((root) => {
  const form = root.querySelector<HTMLFormElement>('form')!, output = root.querySelector<HTMLElement>('[data-tool-output]')!;
  const edition = form.elements.namedItem('edition') as HTMLSelectElement, project = form.elements.namedItem('project') as HTMLSelectElement;
  const version = form.elements.namedItem('version') as HTMLInputElement, loader = form.elements.namedItem('loader') as HTMLSelectElement;
  function syncProjects(): void {
    const previous = project.value;
    project.replaceChildren(new Option(edition.value === 'dungeons' ? 'Official Dungeons II' : 'Official / Vanilla', 'official'));
    projects.filter((item) => item.edition === edition.value).forEach((item) => project.add(new Option(`${item.name} — ${item.author}`, item.id)));
    if (Array.from(project.options).some((option) => option.value === previous)) project.value = previous;
    root.querySelector<HTMLElement>('[data-loader-field]')!.hidden = edition.value !== 'java';
    root.querySelector<HTMLElement>('[data-version-field]')!.hidden = edition.value === 'dungeons';
    version.disabled = edition.value === 'dungeons';
    loader.disabled = edition.value !== 'java';
  }
  const requested = projects.find((item) => item.id === new URLSearchParams(location.search).get('project'));
  if (requested) { edition.value = requested.edition; syncProjects(); project.value = requested.id; }
  else syncProjects();
  function render(): void {
    const environment: Environment = { edition: edition.value as Edition, minecraftVersion: version.value.trim(), loader: edition.value === 'bedrock' ? 'bedrock' : loader.value as Loader };
    if (project.value === 'official') {
      const dungeons = environment.edition === 'dungeons';
      output.replaceChildren(element('h3',dungeons?'Playable in Minecraft Dungeons II':'Vanilla The Sift is planned for 2027'),element('p',dungeons?'Dungeons II launched September 29, 2026. This is a separate official game; it does not use a Java mod loader.':'The announced Java and Bedrock window is 2027. A specific release date, Minecraft build and complete vanilla entrance procedure are not confirmed in the checked sources.'));
      output.append(link(dungeons?'Official launch announcement ↗':'Official Java & Bedrock announcement ↗',dungeons?'https://www.minecraft.net/en-us/article/minecraft-dungeons-ii-is-live':'https://news.xbox.com/en-us/2026/09/26/minecraft-new-dimension-sift-dungeons-2/'),element('p','Sources checked September 30, 2026.'),link('Current availability →','/versions/'));
      output.hidden=false;return;
    }
    const result = findCompatibility(projects, project.value, environment), selected = projects.find((item) => item.id === project.value);
    output.replaceChildren(element('h3', result.status === 'compatible' ? 'Compatible published build found' : result.status === 'incompatible' ? 'Not compatible with this edition' : 'No verified matching build found'), element('p', result.reason, 'tool-status'));
    if (selected) output.append(element('p', `${selected.name} · ${selected.author} · Last verified ${selected.lastVerified}`, 'tool-source'));
    if (selected) result.releases.forEach((release) => output.append(releaseCard(selected, release)));
    if (result.alternatives.length) {
      output.append(element('h3', 'Verified alternatives for your setup'));
      result.alternatives.forEach(({ project, release }) => output.append(releaseCard(project, release)));
    }
    if (selected && !result.releases.length) output.append(link('Check the author’s project page ↗', selected.projectUrl));
    const next = element('p', undefined, 'tool-actions');
    next.append(link('Current availability →', '/versions/'), link('Installation guide →', '/guides/install-the-sift-mod/'), link('Browse projects →', '/mods/'));
    output.append(next); output.hidden = false;
  }
  edition.addEventListener('change', () => { syncProjects(); output.hidden = true; });
  form.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  form.hidden = false;
}));
