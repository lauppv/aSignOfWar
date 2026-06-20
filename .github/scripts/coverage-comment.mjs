import fs from "node:fs";

const [, , label, coveragePath] = process.argv;
const GATE = 90;

function icon(pct) {
  if (pct >= GATE) return "🟢";
  if (pct >= 70) return "🟡";
  return "🔴";
}

const fmt = (pct) => `${pct.toFixed(1)}%`;

function errorComment(message) {
  return `## 📊 Coverage — ${label}\n\n❌ **Coverage report could not be generated**\n\n${message}`;
}

try {
  if (!fs.existsSync(coveragePath)) {
    console.log(
      errorComment("Coverage summary file not found. Tests may not have run successfully."),
    );
    process.exit(0);
  }

  const t = JSON.parse(fs.readFileSync(coveragePath, "utf8")).total;

  console.log(`## 📊 Coverage — ${label}

| Metric | Coverage | Status | Covered / Total |
|--------|----------|--------|-----------------|
| Lines | ${fmt(t.lines.pct)} | ${icon(t.lines.pct)} | ${t.lines.covered}/${t.lines.total} |
| Functions | ${fmt(t.functions.pct)} | ${icon(t.functions.pct)} | ${t.functions.covered}/${t.functions.total} |
| Branches | ${fmt(t.branches.pct)} | ${icon(t.branches.pct)} | ${t.branches.covered}/${t.branches.total} |
| Statements | ${fmt(t.statements.pct)} | ${icon(t.statements.pct)} | ${t.statements.covered}/${t.statements.total} |

_Gate: ${GATE}% across lines, branches, functions and statements (🟢 ≥ ${GATE}% · 🟡 ≥ 70% · 🔴 below)._`);
} catch (e) {
  console.log(errorComment(e.message));
}
