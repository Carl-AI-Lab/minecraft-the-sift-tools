import { projects } from './database.ts';
import { checkMetadataCompatibility, identifyProject } from './compatibility.ts';
import { element, facts, link, ready } from './dom.ts';
import type { Edition, FileInspection, FileMetadata, Loader } from './types.ts';

ready(() => document.querySelectorAll<HTMLElement>('[data-file-tool]').forEach((root) => {
  const input = root.querySelector<HTMLInputElement>('[data-file-input]')!, drop = root.querySelector<HTMLElement>('[data-file-drop]')!;
  const status = root.querySelector<HTMLElement>('[data-file-status]')!, results = root.querySelector<HTMLElement>('[data-file-results]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-file-clear]')!, form = root.querySelector<HTMLFormElement>('[data-file-environment]')!;
  const comparison = root.querySelector<HTMLElement>('[data-file-comparison]')!;
  const edition = form.elements.namedItem('edition') as HTMLSelectElement, version = form.elements.namedItem('version') as HTMLInputElement, loader = form.elements.namedItem('loader') as HTMLSelectElement;
  let worker: Worker | null = null, timer: ReturnType<typeof setTimeout> | undefined, generation = 0, records: FileMetadata[] = [];
  const stop = () => { worker?.terminate(); worker = null; if (timer) clearTimeout(timer); };
  function reset(): void {
    generation++; stop(); records = []; input.value = ''; results.replaceChildren(); results.hidden = true; form.hidden = true;
    comparison.replaceChildren(); clear.hidden = true; status.textContent = 'Choose a local file to read its metadata.';
  }
  function show(result: FileInspection): void {
    stop(); results.replaceChildren(); results.hidden = false;
    if (!result.ok) {
      const labels = { corrupt: 'Archive or metadata could not be parsed', unrecognized: 'Supported metadata was not recognized', unsupported: 'Package format is unsupported', limit: 'Inspection stopped at a safety limit' };
      status.textContent = labels[result.code];
      results.append(element('p', result.message), element('p', 'Possible reasons include an unsupported project or metadata format, a corrupted archive, or a file that is not a supported Minecraft package. This result does not by itself prove the file is an invalid mod.', 'tool-help'));
      return;
    }
    records = result.metadata;
    status.textContent = `Metadata read locally: ${records.length} record${records.length === 1 ? '' : 's'}. No file code was executed.`;
    for (const record of records) {
      const project = identifyProject(record, projects), card = element('article');
      card.append(element('h3', record.name));
      card.append(facts([['Project', project ? `${project.name} — metadata candidate only` : 'Could not be identified as a supported The Sift project'], ['Mod / pack ID', record.id ?? 'Not declared'], ['Version', record.version ?? 'Not resolved from metadata'], ['Edition / loader', `${record.edition} / ${record.loader}`], ['Minecraft constraint', record.minecraft ?? 'Not declared'], ['Author declared by file', record.authors.join(', ') || 'Not declared'], ['Pack type', record.packType ?? 'Java mod'], ['Metadata location', record.path]]));
      if (record.description) card.append(element('p', record.description));
      card.append(element('p', record.dependencies === null ? 'Dependencies: not declared or not recognized; this is not evidence that there are no dependencies.' : `Dependencies: ${record.dependencies.map((dependency) => `${dependency.name}${dependency.requirement ? ` ${dependency.requirement}` : ''}${dependency.optional ? ' (optional)' : ''}`).join('; ') || 'An empty dependency list is declared by this file.'}`));
      if (project) card.append(element('p', `Site record: ${project.author} · last verified ${project.lastVerified}`, 'tool-source'), link('Compare with the author’s project page ↗', project.projectUrl));
      const next = element('p'); next.append(link('Find a verified matching build →', `/tools/compatibility-checker/${project ? `?project=${encodeURIComponent(project.id)}` : ''}`)); card.append(next);
      results.append(card);
    }
    results.append(element('p', 'All displayed file declarations are untrusted. Matching metadata does not establish authenticity, integrity of the entire package, safety, or runtime compatibility.', 'tool-help'));
    const first = records[0];
    if (first) { edition.value = first.edition; loader.value = first.loader === 'bedrock' ? 'fabric' : first.loader; }
    syncEdition(); form.hidden = false;
  }
  async function inspect(file: File): Promise<void> {
    reset(); const current = generation; clear.hidden = false;
    if (file.size > 64 * 1024 * 1024) { show({ ok: false, code: 'limit', message: 'The selected file is larger than 64 MiB.' }); return; }
    if (!/\.(jar|mcpack|mcaddon)$/i.test(file.name)) { show({ ok: false, code: 'unsupported', message: 'Choose a .jar, .mcpack or .mcaddon file.' }); return; }
    if (typeof Worker === 'undefined') { show({ ok: false, code: 'unsupported', message: 'This browser cannot run the isolated local inspection Worker.' }); return; }
    status.textContent = 'Reading local metadata…';
    try {
      const bytes = await file.arrayBuffer();
      if (current !== generation) return;
      worker = new Worker(new URL('./file-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<FileInspection>) => { if (current === generation) show(event.data); };
      worker.onerror = () => { if (current === generation) show({ ok: false, code: 'unsupported', message: 'Local inspection could not run in this browser. No file was uploaded.' }); };
      timer = setTimeout(() => { if (current === generation) show({ ok: false, code: 'limit', message: 'Inspection exceeded the local processing time limit.' }); }, 8000);
      worker.postMessage({ bytes, filename: file.name }, [bytes]);
    } catch { if (current === generation) show({ ok: false, code: 'corrupt', message: 'The browser could not read the selected local file.' }); }
  }
  function syncEdition(): void { root.querySelector<HTMLElement>('[data-file-loader-field]')!.hidden = edition.value !== 'java'; loader.disabled = edition.value !== 'java'; comparison.replaceChildren(); }
  edition.addEventListener('change', syncEdition);
  form.addEventListener('submit', (event) => {
    event.preventDefault(); comparison.replaceChildren();
    records.forEach((record) => {
      const result = checkMetadataCompatibility(record, { edition: edition.value as Edition, minecraftVersion: version.value.trim(), loader: edition.value === 'bedrock' ? 'bedrock' : loader.value as Loader });
      const card = element('article'); card.dataset.compatibilityResult = result.status;
      card.append(element('h3', `${record.name}: ${result.status === 'compatible' ? 'Declarations match' : result.status === 'incompatible' ? 'Does not match your setup' : 'Compatibility unknown'}`), element('p', result.reason), element('p', `File: ${record.minecraft ?? 'unknown version'} + ${record.loader}. Your setup: ${version.value.trim()} + ${edition.value === 'bedrock' ? 'Bedrock' : loader.value}.`));
      const project = identifyProject(record, projects); card.append(link('Find a matching build →', `/tools/compatibility-checker/${project ? `?project=${encodeURIComponent(project.id)}` : ''}`)); comparison.append(card);
    });
  });
  input.addEventListener('change', () => { const file = input.files?.[0]; if (file) void inspect(file); });
  clear.addEventListener('click', () => { reset(); input.focus(); });
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.dataset.dragging = 'true'; });
  drop.addEventListener('dragleave', () => { drop.dataset.dragging = 'false'; });
  drop.addEventListener('drop', (event) => { event.preventDefault(); drop.dataset.dragging = 'false'; if (event.dataTransfer?.files.length !== 1) { status.textContent = 'Drop one package at a time.'; return; } const file = event.dataTransfer.files[0]; if (file) void inspect(file); });
  root.querySelector<HTMLElement>('[data-tool-controls]')!.hidden = false;
}));
