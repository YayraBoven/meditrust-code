/**
 * Collects every English sentence MediTrust can show, then machine-translates
 * the missing ones into Twi, Ewe, Ga and Dagbani with GhanaNLP's Khaya API.
 *
 *   KHAYA_API_KEY=... npx tsx scripts/translate.ts            # translate missing strings
 *   npx tsx scripts/translate.ts --extract-only                # just list strings
 *   KHAYA_API_KEY=... npx tsx scripts/translate.ts --only=twi  # one language
 *   npx tsx scripts/translate.ts --sheets                      # write review sheets only
 *   npx tsx scripts/translate.ts --import                      # read corrected sheets back in
 *
 * Results are saved after every string, so the script can be stopped and re-run.
 * Fluent speakers must review the output (see docs/translations/*.csv).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { ALL_RULES } from '../src/data/rules';
import { INGREDIENTS } from '../src/data/medicines';
import { CHECK_LABELS, FLAG_TITLES, G6PD_UNSURE_NOTE } from '../src/engine/checks';
import * as explain from '../src/engine/explain';

const ROOT = join(import.meta.dirname, '..');
const UI_DIRS = ['src/screens', 'src/components', 'src/engine', 'src/lib'];

function looksLikeText(s: string): boolean {
  if (s.length < 2 || s.length > 400) return false;
  if (/^[\s·(),.:;-]/.test(s)) return false; // fragments such as " · RxNorm" or "(min-width…)"
  if (!/[A-Za-z]/.test(s)) return false;
  if (/^[a-z0-9_.:/#-]+$/.test(s)) return false; // ids, paths, keys
  if (/^(https?:|\/|#|\.\/|\.\.\/)/.test(s)) return false;
  if (/[[\]{}<>=]|\b(px|rgba?|var\(|translate|flex|grid|text-|bg-|rounded|border)\b/.test(s)) return false;
  if (/^[A-Z][A-Za-z]+$/.test(s) && s.length > 20) return false;
  return /^[A-Z“"(]/.test(s) || s.includes(' ');
}

const TEXT_PROPS = new Set(['label', 'hint', 'eyebrow', 'title', 'accent', 'body', 'action', 'sub', 'headline', 'lead', 'message']);
const TEXT_ATTRS = new Set(['title', 'label', 'sub', 'aria-label', 'placeholder', 'alt']);

/** Is this node inside a call to t(...)? */
function insideT(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 't') return true;
    if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

/** Literal inside an array that is mapped in JSX ([...].map) or held by an UPPER_CASE constant. */
function inTextArray(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isArrayLiteralExpression(p) || ts.isObjectLiteralExpression(p) || ts.isPropertyAssignment(p) || ts.isAsExpression(p) || ts.isParenthesizedExpression(p)) {
      const up = p.parent;
      if (up && ts.isPropertyAccessExpression(up) && up.name.text === 'map') return true;
      if (up && ts.isVariableDeclaration(up) && /^[A-Z][A-Z0-9_]+$/.test(up.name.getText())) return true;
      continue;
    }
    return false;
  }
  return false;
}

function collectFromFile(file: string, out: Set<string>) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const ok =
        insideT(node) ||
        (ts.isPropertyAssignment(parent) && TEXT_PROPS.has(parent.name.getText())) ||
        (ts.isJsxAttribute(parent) && TEXT_ATTRS.has(parent.name.getText())) ||
        inTextArray(node);
      if (ok && looksLikeText(node.text)) out.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : /\.(tsx?)$/.test(d.name) && !d.name.endsWith('.test.ts') ? [join(dir, d.name)] : []));
}

export function extract(): string[] {
  const out = new Set<string>();
  for (const dir of UI_DIRS) for (const f of walk(join(ROOT, dir))) collectFromFile(f, out);
  ALL_RULES.forEach((r) => out.add(r.message));
  Object.values(INGREDIENTS).forEach((i) => out.add(i.kind));
  Object.values(CHECK_LABELS).forEach((l) => out.add(l));
  Object.values(FLAG_TITLES).forEach((l) => out.add(l));
  Object.values(explain.LEVEL_COPY).forEach((c) => [c.label, c.headline, c.lead].forEach((x) => out.add(x)));
  [explain.REFERRAL, explain.NOT_SAFE_NOTE, explain.MORE_POINTS, explain.NO_CONCERN, explain.UNVERIFIED_NOTE, G6PD_UNSURE_NOTE].forEach((x) => out.add(x));
  return [...out].filter(looksLikeText).sort();
}

const LANGS: Record<string, string> = { twi: 'en-tw', ewe: 'en-ee', gaa: 'en-gaa', dag: 'en-dag' };

const RULE_TEXT = new Set([...ALL_RULES.map((r) => r.message), ...Object.values(INGREDIENTS).map((i) => i.kind)]);

/** Review sheets for fluent speakers: English, current translation, a column for corrections. */
function writeSheets(strings: string[]) {
  mkdirSync(join(ROOT, 'docs/translations'), { recursive: true });
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  for (const lang of Object.keys(LANGS)) {
    const table: Record<string, string> = JSON.parse(readFileSync(join(ROOT, `src/i18n/${lang}.json`), 'utf8'));
    // Screens first (needed for the demo), then safety-rule messages and medicine descriptions.
    const ordered = [...strings.filter((s) => !RULE_TEXT.has(s)), ...strings.filter((s) => RULE_TEXT.has(s))];
    const rows = [
      'Priority,English,Current translation,Correction or new translation (leave empty if fine),Reviewer notes',
      ...ordered.map((s) => [RULE_TEXT.has(s) ? 'Later' : 'High', q(s), q(table[s] ?? ''), '', ''].join(',')),
    ];
    writeFileSync(join(ROOT, `docs/translations/${lang}.csv`), '\uFEFF' + rows.join('\n') + '\n');
  }
  console.log('Review sheets written to docs/translations/');
}

/** Minimal CSV reader (quoted fields, commas, newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

/** Bring reviewers' corrections from docs/translations/<lang>.csv back into the app. */
function importSheets(strings: string[]) {
  for (const lang of Object.keys(LANGS)) {
    const csv = join(ROOT, `docs/translations/${lang}.csv`);
    let rows: string[][];
    try {
      rows = parseCsv(readFileSync(csv, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      continue;
    }
    const file = join(ROOT, `src/i18n/${lang}.json`);
    const table: Record<string, string> = JSON.parse(readFileSync(file, 'utf8'));
    let changed = 0;
    for (const [, english, current, correction] of rows.slice(1)) {
      const value = (correction || current || '').trim();
      if (english && value && strings.includes(english) && table[english] !== value) {
        table[english] = value;
        changed++;
      }
    }
    writeFileSync(file, JSON.stringify(Object.fromEntries(strings.filter((s) => table[s]).map((s) => [s, table[s]])), null, 2) + '\n');
    console.log(`${lang}: ${changed} translations imported`);
  }
}

async function main() {
  const strings = extract();
  writeFileSync(join(ROOT, 'src/i18n/strings.json'), JSON.stringify(strings, null, 2) + '\n');
  console.log(`${strings.length} English strings`);
  if (process.argv.includes('--extract-only')) return;
  if (process.argv.includes('--import')) return importSheets(strings);
  if (process.argv.includes('--sheets')) {
    // Drop translations of strings the app no longer uses, then write the sheets.
    for (const lang of Object.keys(LANGS)) {
      const file = join(ROOT, `src/i18n/${lang}.json`);
      const table: Record<string, string> = JSON.parse(readFileSync(file, 'utf8'));
      writeFileSync(file, JSON.stringify(Object.fromEntries(strings.filter((s) => table[s]).map((s) => [s, table[s]])), null, 2) + '\n');
    }
    return writeSheets(strings);
  }

  const key = process.env.KHAYA_API_KEY;
  if (!key) throw new Error('Set KHAYA_API_KEY');
  if (process.env.HTTPS_PROXY) {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
  }
  const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  const translateLang = async (lang: string, pair: string) => {
    const file = join(ROOT, `src/i18n/${lang}.json`);
    const table: Record<string, string> = JSON.parse(readFileSync(file, 'utf8'));
    const todo = strings.filter((s) => !table[s]);
    console.log(`${lang}: ${todo.length} to translate`);
    let n = 0;
    for (const s of todo) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch('https://translation-api.ghananlp.org/v1/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': key },
          body: JSON.stringify({ in: s, lang: pair }),
        });
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new Error(`${lang} ${res.status}: ${await res.text()}`);
        const out = await res.json();
        table[s] = typeof out === 'string' ? out.trim() : String(out);
        break;
      }
      if (++n % 25 === 0 || n === todo.length) {
        writeFileSync(file, JSON.stringify(table, null, 2) + '\n');
        console.log(`  ${lang} ${n}/${todo.length}`);
      }
    }
    // Keep only strings the app still uses, sorted for readable diffs.
    const clean = Object.fromEntries(strings.filter((s) => table[s]).map((s) => [s, table[s]]));
    writeFileSync(file, JSON.stringify(clean, null, 2) + '\n');
  };
  await Promise.all(Object.entries(LANGS).filter(([lang]) => !only || only === lang).map(([lang, pair]) => translateLang(lang, pair)));

  writeSheets(strings);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
