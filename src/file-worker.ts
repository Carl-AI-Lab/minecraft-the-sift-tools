import { inspectFile } from './file-checker.ts';
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ bytes: ArrayBuffer; filename: string }>) => void) | null; postMessage: (message: unknown) => void };
scope.onmessage = (event) => {
  scope.postMessage(inspectFile(new Uint8Array(event.data.bytes), event.data.filename));
};
