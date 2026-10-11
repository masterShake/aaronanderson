/**
 * Reads src/content statically through the TypeScript compiler API instead of
 * executing it: no loader, no @/ alias resolution, no hold() side effects, and
 * every string comes with its file:line and the property it belongs to.
 */
import ts from 'typescript'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repo root (this file lives in scripts/lib). */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Every .ts/.tsx file under dir (relative to ROOT), minus the repo-relative paths in skip. */
export function listTs(dir, skip = []) {
  const out = []
  const abs = join(ROOT, dir)
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const p = join(abs, e.name)
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue
      out.push(...listTs(relative(ROOT, p), skip))
    } else if (
      /\.tsx?$/.test(e.name) &&
      !e.name.endsWith('.d.ts') &&
      !skip.includes(relative(ROOT, p))
    )
      out.push(p)
  }
  return out
}

const parse = (f) =>
  ts.createSourceFile(
    f,
    readFileSync(f, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
const at = (sf, n) => {
  const { line, character } = sf.getLineAndCharacterOfPosition(n.getStart(sf))
  return { line: line + 1, col: character + 1 }
}
const keyName = (p) => p.name.getText().replace(/^['"]|['"]$/g, '')

function keyPath(n) {
  const path = []
  for (let p = n.parent; p; p = p.parent)
    if (ts.isPropertyAssignment(p) && p.name !== n) path.unshift(keyName(p))
  return path
}
function enclosingCall(n) {
  for (let p = n.parent, c = n; p; c = p, p = p.parent)
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression))
      return { name: p.expression.text, arg: p.arguments.indexOf(c) }
  return null
}
function inTypeOrImport(n) {
  for (let p = n.parent; p; p = p.parent)
    if (ts.isTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true
  return false
}

/** Every string value in the file, with its key path and its enclosing call. */
export function strings(file) {
  const sf = parse(file)
  const out = []
  const visit = (n) => {
    const isStr = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
    if (
      isStr &&
      !inTypeOrImport(n) &&
      !(ts.isPropertyAssignment(n.parent) && n.parent.name === n) &&
      !ts.isElementAccessExpression(n.parent)
    ) {
      const path = keyPath(n)
      out.push({
        file: relative(ROOT, file),
        ...at(sf, n),
        value: n.text,
        key: path.at(-1) ?? null,
        path,
        call: enclosingCall(n),
      })
    }
    if (ts.isTemplateExpression(n))
      out.push({
        file: relative(ROOT, file),
        ...at(sf, n),
        value: n.getText(sf),
        template: true,
        path: keyPath(n),
        call: null,
      })
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

const lit = (v) =>
  ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)
    ? v.text
    : v.kind === ts.SyntaxKind.TrueKeyword
      ? true
      : v.kind === ts.SyntaxKind.FalseKeyword
        ? false
        : v.kind === ts.SyntaxKind.NullKeyword
          ? null
          : v.getText()

/** hold(note, {...}) and confirm(value, {...}) calls, with their options read literally. */
export function calls(file, names = ['hold', 'confirm']) {
  const sf = parse(file)
  const out = []
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      names.includes(n.expression.text)
    ) {
      const [first, opts] = n.arguments
      const o = {}
      if (opts && ts.isObjectLiteralExpression(opts))
        for (const p of opts.properties)
          if (ts.isPropertyAssignment(p)) o[keyName(p)] = lit(p.initializer)
      out.push({
        name: n.expression.text,
        file: relative(ROOT, file),
        ...at(sf, n),
        first: first ? lit(first) : '',
        ...o,
      })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}
