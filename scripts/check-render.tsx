import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const memory = new Map<string, string>([
  ['papercompile.course.active', 'DS-2025'],
]);

(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  },
  location: { assign: () => undefined },
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
  setTimeout,
};

const pages = [
  ['/outline', (await import('../src/pages/OutlinePage')).default],
  ['/knowledge', (await import('../src/pages/KnowledgePointPage')).default],
  ['/blueprint', (await import('../src/pages/BlueprintPage')).default],
  ['/contract', (await import('../src/pages/ContractPage')).default],
  ['/proposition', (await import('../src/pages/PropositionPage')).default],
  ['/review', (await import('../src/pages/ReviewPage')).default],
  ['/compose', (await import('../src/pages/ComposePage')).default],
  ['/replay', (await import('../src/pages/ReplayPage')).default],
] as const;

for (const [path, Page] of pages) {
  try {
    const html = renderToString(
      createElement(MemoryRouter, { initialEntries: [path] }, createElement(Page)),
    );
    console.log(`${path}: ${html.length} chars`);
  } catch (error) {
    console.error(`RENDER FAIL ${path}`, error);
    process.exitCode = 1;
  }
}
