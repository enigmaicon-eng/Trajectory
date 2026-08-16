// AC-9.36: "No string containing 'AI', 'prompt', 'token', 'LLM', or 'model'
// appears in primary UI copy (enforced by a lint test over user-facing
// strings)." §6.4: "The system speaks about plans, weeks, risks, and
// evidence" — never the underlying AI mechanics.
//
// Parses each .tsx file's real AST (not a grep) so import paths, code
// identifiers (e.g. `q.prompt`), and href/route strings never false-positive
// — only rendered JSX text and a fixed set of user-visible JSX attributes
// count as "copy."
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import ts from "typescript";

const FORBIDDEN = /\b(ai|llm|prompt|token|model)\b/i;
const COPY_ATTRS = new Set(["placeholder", "aria-label", "alt", "title"]);
const ROOTS = ["src/app", "src/components"];

interface Finding {
  text: string;
  line: number;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (extname(full) === ".tsx") out.push(full);
  }
  return out;
}

function extractCopy(filePath: string): Finding[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];

  function lineOf(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text) findings.push({ text, line: lineOf(node.getStart(sourceFile)) });
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (COPY_ATTRS.has(node.name.getText(sourceFile))) {
        findings.push({ text: node.initializer.text, line: lineOf(node.getStart(sourceFile)) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}

describe("AC-9.36: no AI/LLM/prompt/token/model in primary UI copy", () => {
  const files = ROOTS.flatMap((root) => walk(root));
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    it(`${file} has no forbidden jargon in rendered copy`, () => {
      const findings = extractCopy(file).filter((f) => FORBIDDEN.test(f.text));
      if (findings.length > 0) {
        const detail = findings.map((f) => `  line ${f.line}: "${f.text}"`).join("\n");
        throw new Error(`Forbidden AI-jargon in user-facing copy in ${file}:\n${detail}`);
      }
      expect(findings).toHaveLength(0);
    });
  }
});
