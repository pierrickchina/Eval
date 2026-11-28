import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// foundations.js dépend du navigateur (DOM) : on ne teste ici que la logique pure du fichier de modèle.
const src = await (await import('node:fs/promises')).readFile(new URL('../js/ui/foundations.js', import.meta.url), 'utf8');
test('le fichier de modèle ne contient aucune donnée d\'élève', () => {
  const fn = src.slice(src.indexOf('export function modelToFile'), src.indexOf('export async function shareModel'));
  assert.ok(!/student|classId|results/.test(fn));
});
test('format du fichier de modèle', () => {
  assert.match(src, /type: MODEL_TYPE, version: 1/);
});
