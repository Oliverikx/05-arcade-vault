import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname } from "node:path";

const PRETTIER_EXTS = new Set([".md", ".mdx", ".js", ".jsx", ".ts", ".tsx", ".json", ".css"]);
const ESLINT_EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);

let input = "";
for await (const chunk of process.stdin) input += chunk;

let filePath;
try {
  filePath = JSON.parse(input)?.tool_input?.file_path;
} catch {
  process.exit(0);
}

if (!filePath || !existsSync(filePath)) process.exit(0);

const ext = extname(filePath).toLowerCase();
if (!PRETTIER_EXTS.has(ext)) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function run(args) {
  const res = spawnSync("npx", args, { cwd, encoding: "utf8", shell: true });
  if (res.status !== 0) {
    process.stderr.write(`${args.slice(0, 2).join(" ")} failed:\n${res.stdout}${res.stderr}`);
  }
}

run(["prettier", "--write", `"${filePath}"`]);
if (ESLINT_EXTS.has(ext)) {
  run(["eslint", "--fix", "--no-warn-ignored", `"${filePath}"`]);
}
process.exit(0);
