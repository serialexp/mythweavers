import { describe, it, expect } from 'vitest';

import { processPastedText } from './textProcessing';

describe('processPastedText', () => {
  it('separates block-level HTML paragraphs with blank lines', () => {
    const html = '<div><p>First paragraph.</p><p>Second paragraph.</p></div>';
    const result = processPastedText('', html);
    expect(result).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('preserves single line breaks created by <br> elements', () => {
    const html = '<div>Line one<br>Line two</div>';
    const result = processPastedText('', html);
    expect(result).toBe('Line one\nLine two');
  });

  it('keeps preformatted blocks intact', () => {
    const html = '<pre>const x = 1;\nreturn x;</pre>';
    const result = processPastedText('', html);
    expect(result).toBe('const x = 1;\nreturn x;');
  });

  it('expands plain text line breaks when HTML content is unavailable', () => {
    const text = 'First paragraph.\nSecond paragraph.';
    const result = processPastedText(text);
    expect(result).toBe('First paragraph.\n\nSecond paragraph.');
  });
});
