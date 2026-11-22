const allowedTags = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'a',
  'hr',
]);
const blockedTags = new Set(['script', 'style', 'iframe']);

/**
 * Zachowuje wyłącznie znaczniki formatowania, bez żadnych atrybutów.
 * Usuwa również treść script/style/iframe. Nie korzysta z DOM ani innerHTML.
 * Celowo usuwa także bezpieczne URL, klasy i style; wynik jest fragmentem HTML.
 */
export function sanitizeHtml(html: string): string {
  let output = '';
  const blocked: string[] = [];
  let position = 0;
  while (position < html.length) {
    if (html[position] !== '<') {
      if (blocked.length === 0) output += html[position];
      position++;
      continue;
    }
    if (html.startsWith('<!--', position)) {
      const end = html.indexOf('-->', position + 4);
      position = end === -1 ? html.length : end + 3;
      continue;
    }
    let end = position + 1;
    let quote = '';
    for (; end < html.length; end++) {
      const char = html[end];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') break;
    }
    if (end === html.length) {
      if (blocked.length === 0)
        output += html.slice(position).replaceAll('<', '&lt;');
      break;
    }
    const token = html.slice(position + 1, end);
    const match = /^(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)(?=[\s/]|$)/.exec(token);
    if (match) {
      const closing = match[1] === '/';
      const tag = match[2].toLowerCase();
      if (blockedTags.has(tag)) {
        if (!closing) blocked.push(tag);
        else if (blocked.at(-1) === tag) blocked.pop();
      } else if (blocked.length === 0 && allowedTags.has(tag)) {
        output += `<${closing ? '/' : ''}${tag}>`;
      }
    }
    position = end + 1;
  }
  return output;
}
