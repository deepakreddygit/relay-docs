/** A small, explicit rich-text schema. No HTML is stored or returned. */
const TYPES = new Set(['doc', 'p', 'h1', 'h2', 'ul', 'ol', 'li', 'strong', 'em', 'u', 'br', 'text']);
export const EMPTY_CONTENT = { type: 'doc', children: [{ type: 'p', children: [] }] };

export function validateContent(content) {
  let count = 0;
  let totalChars = 0;
  function walk(value, depth) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 24 || ++count > 4000) return false;
    const keys = Object.keys(value);
    if (!TYPES.has(value.type) || keys.some(k => !['type', 'value', 'children'].includes(k))) return false;
    if (value.type === 'text') {
      if (typeof value.value !== 'string' || value.children !== undefined) return false;
      totalChars += value.value.length;
      return totalChars <= 240000;
    }
    if (value.value !== undefined) return false;
    if (value.children !== undefined && (!Array.isArray(value.children) || !value.children.every(v => walk(v, depth + 1)))) return false;
    return true;
  }
  return content?.type === 'doc' && walk(content, 0) && JSON.stringify(content).length <= 350000;
}
export function plainText(content) {
  const chunks = [];
  function walk(node) {
    if (node.type === 'text') chunks.push(node.value);
    else {
      (node.children ?? []).forEach(walk);
      if (['p', 'h1', 'h2', 'li'].includes(node.type)) chunks.push(' ');
    }
  }
  walk(content);
  return chunks.join('').replace(/\s+/g, ' ').trim();
}
export function validTitle(title) { return typeof title === 'string' && title.trim().length >= 1 && title.trim().length <= 100; }
export function canRead(p) { return p !== null; }
export function canEdit(p) { return p === 'owner' || p === 'edit'; }
export function canManage(p) { return p === 'owner'; }
