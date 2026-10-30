/** Shared validation for dates, locale preferences and provider text. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}
export function decodeNumericEntity(entity: string, digits: string): string {
  const code = Number(digits);
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
    ? String.fromCodePoint(code) : entity;
}
const supportedLanguages = new Set(['en', 'uk', 'es', 'fr', 'de', 'ar', 'zh-CN', 'ja', 'pt', 'hi']);
export function supportedLanguage(value: unknown): string {
  if (typeof value !== 'string') return 'en';
  const base = value.toLowerCase().split('-')[0];
  const language = base === 'zh' ? 'zh-CN' : base;
  return supportedLanguages.has(language) ? language : 'en';
}
