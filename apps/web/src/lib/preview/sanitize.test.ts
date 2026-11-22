import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanityzacja HTML', () => {
  it('zachowuje tekst, encje i bezpieczne formatowanie', () => {
    expect(
      sanitizeHtml(
        '<html><head></head><body><p>Treść &amp; <b>ważne</b><br>koniec</p></body></html>',
      ),
    ).toBe('<p>Treść &amp; <b>ważne</b><br>koniec</p>');
  });

  it.each([
    '<script>alert(1)</script><p>OK</p>',
    '<style>body{display:none}</style><p>OK</p>',
    '<iframe srcdoc="<script>alert(1)</script>">atak</iframe>',
    '<p OnClick="alert(1)" style="background:url(javascript:evil)">tekst</p>',
    '<a href="javascript:alert(1)">link</a><img src="data:text/html,evil" onerror="alert(1)">',
    '<a href="&#x6a;avascript:alert(1)">link</a>',
    '<a href="java&#10;script:alert(1)">link</a><a href="data:text/html,evil">link</a>',
    '<svg><a xlink:href="javascript:alert(1)"><animate onbegin="alert(1)"></animate></a></svg>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
    '<script><script>evil</script>evil</script><p>OK</p>',
    '<ScRiPt src=x/>evil</ScRiPt><STYLE>evil</STYLE>',
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<p title=">" onclick=alert(1)>OK</p>',
    '<<img src=x onerror=alert(1)>',
    '<p title="broken><img src=x onerror=alert(1)>',
    '<!--><img src=x onerror=alert(1)>',
    '<iframe><style>evil</style></iframe><p>OK</p>',
    '<form><input formaction="javascript:alert(1)"><button>tekst</button></form>',
  ])('usuwa aktywną zawartość: %s', (attack) => {
    const clean = sanitizeHtml(attack);
    const container = document.createElement('div');
    container.innerHTML = clean;
    expect(
      container.querySelector('script,style,iframe,img,svg,math,input,form'),
    ).toBeNull();
    for (const element of container.querySelectorAll('*'))
      expect(element.attributes).toHaveLength(0);
    expect(sanitizeHtml(clean)).toBe(clean);
  });

  it('usuwa całą treść zablokowanych elementów, także zagnieżdżonych', () => {
    expect(
      sanitizeHtml(
        'a<script><script>sekret</script>sekret</script>b<style>sekret</style>c<iframe>sekret</iframe>d',
      ),
    ).toBe('abcd');
    expect(sanitizeHtml('<script>niedomknięty')).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});
