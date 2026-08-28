export const RULES_START = "<!-- rules:start -->";
export const RULES_END = "<!-- rules:end -->";

type Rule = {
  name: string;
  message?: string;
  level?: string;
};

function firstMessageLine(message: string | undefined): string {
  const line = (message ?? "").split("\n")[0]?.trim() ?? "";
  return line.replace(/\|/g, "\\|");
}

/**
 * Derives the `Rule | Level | Flags` Markdown table body from parsed rule YAML, with columns
 * padded to rumdl's MD060 `aligned` style. Padding here keeps the generator's output identical
 * to what `rumdl check --fix` (run in the pre-commit hook) would produce, so regenerating the
 * table never conflicts with the autofixer on the next commit.
 */
export function deriveRuleTable(rules: Rule[]): string {
  const sorted = [...rules].sort((a, b) => a.name.localeCompare(b.name));
  const columns = ["Rule", "Level", "Flags"];
  const rows = sorted.map((rule) => [
    `\`${rule.name}\``,
    rule.level ?? "",
    firstMessageLine(rule.message),
  ]);

  const widths = columns.map((col, i) =>
    Math.max(col.length, ...rows.map((row) => row[i]?.length ?? 0)),
  );

  const padRow = (cells: string[]) =>
    `| ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(" | ")} |`;

  const header = padRow(columns);
  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  const body = rows.map((row) => padRow(row));

  return [header, separator, ...body].join("\n");
}
