import { expect, it, vi } from 'vitest';
import React from 'react';

it('renders the OpenGraph card as a PNG in the Node runtime used by OpenNext', async () => {
  // Vitest transforms JSX in classic mode; Next supplies the automatic runtime.
  vi.stubGlobal('React', React);
  try {
    const { default: render } = await import('../src/app/opengraph-image');
    const response = render();
    expect(response.headers.get('content-type')).toBe('image/png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  } finally {
    vi.unstubAllGlobals();
  }
});
