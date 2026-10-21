// Hook PostToolUse (Edit|Write) : reformate le fichier touché.
// Toujours sortir en code 0 : un échec de formatage ne doit jamais bloquer une édition.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(input || "{}");
    const file = payload?.tool_input?.file_path;
    if (!file || !existsSync(file)) process.exit(0);

    const ext = extname(file).toLowerCase();
    const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
    const opts = { cwd: root, stdio: "ignore", windowsHide: true };

    if ([".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md"].includes(ext)) {
      execFileSync("pnpm", ["exec", "prettier", "--write", "--log-level", "silent", file], {
        ...opts,
        shell: true,
      });
    } else if (ext === ".rs") {
      execFileSync("rustfmt", ["--edition", "2024", file], opts);
    }
  } catch {
    // silencieux volontairement
  }
  process.exit(0);
});
