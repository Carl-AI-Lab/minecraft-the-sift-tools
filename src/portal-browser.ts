import { projects } from './database.ts';
import { element, facts, link, ready } from './dom.ts';
ready(() => document.querySelectorAll<HTMLElement>('[data-portal-tool]').forEach((root) => {
  const select = root.querySelector<HTMLSelectElement>('[data-portal-choice]')!, output = root.querySelector<HTMLElement>('[data-tool-output]')!;
  function render(): void {
    const project = projects.find((item) => item.id === select.value);
    output.replaceChildren();
    if (project) {
      output.append(element('h3', project.name), facts([['Author', project.author], ['Entry type', project.portal.type], ['Current status', project.portal.status === 'documented' ? 'Documented by this author' : 'Entry procedure not verified'], ['Last verified', project.lastVerified]]), element('p', project.portal.instructions));
      const actions = element('p', undefined, 'tool-actions');
      actions.append(link('Full entry guide →', project.portal.guideUrl), link('Author / source ↗', project.projectUrl)); output.append(actions);
    } else if (select.value === 'dungeons') {
      output.append(element('h3', 'Minecraft Dungeons II'), element('p', 'The Sift is part of the official game. An exact unlock level or step-by-step entry route has not been verified from the official sources used here. Follow Dungeons II progression guidance, not Java mod portal instructions.'), element('p', 'Status: official game available · Last verified 2026-09-30', 'tool-source'), link('Dungeons II overview →', '/dungeons-2/'));
    } else {
      output.append(element('h3', select.value === 'java-vanilla' ? 'Minecraft Java / Vanilla' : 'Minecraft Bedrock / Vanilla'), element('p', 'Official entry method: not announced yet. Do not use community-mod portal instructions for vanilla Minecraft.'), element('p', 'Status: announced for 2027 · Last verified 2026-09-30', 'tool-source'), link('Official availability and sources →', '/versions/'));
    }
    output.hidden = false;
  }
  select.addEventListener('change', render);
  root.querySelector<HTMLElement>('[data-tool-controls]')!.hidden = false;
  render();
}));
