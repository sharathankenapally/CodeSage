import { Router, type IRouter, type Request, type Response } from "express";
import { FetchGithubRepoBody } from "@workspace/api-zod";

const router: IRouter = Router();

interface GithubTreeItem {
  path: string;
  type: string;
  sha: string;
  url: string;
}

interface GithubTreeResponse {
  tree: GithubTreeItem[];
  truncated: boolean;
}

interface GithubFileContent {
  content: string;
  encoding: string;
}

const BACKEND_EXTENSIONS = new Set([
  // Python
  ".py", ".pyw",
  // JavaScript / TypeScript
  ".ts", ".js", ".mjs", ".cjs",
  // Go
  ".go",
  // Java / JVM
  ".java", ".kt", ".kts", ".scala", ".groovy",
  // Ruby
  ".rb", ".rake", ".ru",
  // PHP
  ".php",
  // Rust
  ".rs",
  // C / C++
  ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp",
  // C#
  ".cs",
  // Swift
  ".swift",
  // Shell scripts
  ".sh", ".bash",
  // SQL
  ".sql",
  // Schema / API definition
  ".proto", ".graphql", ".gql",
  // Elixir / Erlang
  ".ex", ".exs", ".erl",
  // Haskell
  ".hs",
  // Dart
  ".dart",
  // Lua
  ".lua",
  // Clojure
  ".clj", ".cljs",
]);

const UI_EXTENSIONS = new Set([
  ".tsx", ".jsx", ".vue", ".svelte",
  ".css", ".scss", ".less", ".sass",
  ".html", ".htm",
]);

const IGNORE_SEGMENTS = new Set([
  "__pycache__", ".egg-info", "node_modules", ".git",
  "venv", ".venv", "env", ".env",
  "dist", "build", "target", "out", "bin", "obj",
  "migrations", ".tox", ".pytest_cache", "coverage",
  ".generated", "generated", "vendor",
  ".cargo", ".gradle", "gradle",
  "__mocks__", "testdata", "test-data", "fixtures",
]);

const IGNORE_FILE_PATTERNS = [
  ".test.", ".spec.", "_test.", "Test.", "Spec.",
  ".stories.", ".story.",
  "jest.config", "vite.config", "webpack.config",
  "tailwind.config", "postcss.config",
  "eslint", ".prettierrc", ".editorconfig",
  "drizzle.config", "orval.config",
  "tsconfig", ".d.ts",
  "package.json", "pnpm-lock", "package-lock", "yarn.lock",
  "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock",
  ".min.",
];

function getExt(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return "";
  return filePath.slice(dot).toLowerCase();
}

function isBackendFile(path: string): boolean {
  const segments = path.split("/");

  // Reject if any path segment is an ignored directory
  for (const seg of segments) {
    if (IGNORE_SEGMENTS.has(seg)) return false;
  }

  const fileName = segments[segments.length - 1];

  // Reject UI file extensions
  const ext = getExt(fileName);
  if (UI_EXTENSIONS.has(ext)) return false;

  // Reject files matching ignore patterns
  if (IGNORE_FILE_PATTERNS.some((pat) => path.includes(pat))) return false;

  return BACKEND_EXTENSIONS.has(ext);
}

/**
 * Returns the appropriate single-line comment prefix for a given file path.
 */
function commentPrefix(filePath: string): string {
  const ext = getExt(filePath);
  if ([".py", ".pyw", ".rb", ".rake", ".ru", ".sh", ".bash", ".pl", ".r"].includes(ext)) return "#";
  if ([".sql", ".lua", ".hs", ".erl"].includes(ext)) return "--";
  if ([".ex", ".exs"].includes(ext)) return "#";
  return "//";
}

/**
 * Parse a GitHub URL and return owner, repo, and optional branch embedded in the URL.
 * Supports:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo/tree/branchname
 *   https://github.com/owner/repo/tree/feature/my-feature
 *   git@github.com:owner/repo.git
 */
function parseGithubUrl(url: string): { owner: string; repo: string; urlBranch?: string } | null {
  try {
    const cleaned = url.trim().replace(/\/$/, "");

    // Match owner/repo and optionally /tree/<branch>
    const match = cleaned.match(
      /github\.com[/:]([^/\s]+)\/([^/.\s]+?)(?:\.git)?(?:\/tree\/([^\s?#]+))?(?:[?#].*)?$/
    );
    if (!match) return null;

    return {
      owner: match[1],
      repo: match[2],
      urlBranch: match[3] || undefined,
    };
  } catch {
    return null;
  }
}

async function githubFetch(path: string, token?: string | null): Promise<globalThis.Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "CodeAnalyzer/1.0",
  };
  // Only send auth if the user explicitly provided a token — do NOT fall back to
  // GITHUB_TOKEN env var, as an expired/invalid env token breaks public repo access.
  if (token && token.trim()) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }
  return fetch(`https://api.github.com${path}`, { headers });
}

router.post("/github/fetch", async (req: Request, res: Response): Promise<void> => {
  const parsed = FetchGithubRepoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { repoUrl, branch, githubToken, maxFiles } = parsed.data;
  const limit = maxFiles ?? 100;

  const parts = parseGithubUrl(repoUrl);
  if (!parts) {
    res.status(400).json({
      error:
        "Invalid GitHub URL. Expected formats:\n" +
        "  https://github.com/owner/repo\n" +
        "  https://github.com/owner/repo/tree/branchname",
    });
    return;
  }

  const { owner, repo } = parts;

  // Priority: explicit branch field > branch embedded in URL > default branch from API
  let targetBranch: string | null = branch || parts.urlBranch || null;

  if (!targetBranch) {
    const repoResp = await githubFetch(`/repos/${owner}/${repo}`, githubToken);
    if (!repoResp.ok) {
      if (repoResp.status === 401) {
        res.status(422).json({
          error: "GitHub authentication failed. For private repos, expand 'Private repo' and add a valid token (ghp_… or fine-grained PAT with Contents: Read).",
        });
      } else if (repoResp.status === 404) {
        res.status(422).json({
          error: `Repository not found: github.com/${owner}/${repo}. Check the URL spelling, or add a token if this is a private repo.`,
        });
      } else if (repoResp.status === 403) {
        res.status(422).json({
          error: "GitHub API rate limit reached. Add a GitHub token (ghp_…) to get a higher limit.",
        });
      } else {
        const errText = await repoResp.text();
        res.status(422).json({ error: `GitHub API error (${repoResp.status}): ${errText}` });
      }
      return;
    }
    const repoData = (await repoResp.json()) as { default_branch: string };
    targetBranch = repoData.default_branch;
  }

  const treeResp = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
    githubToken
  );

  if (!treeResp.ok) {
    if (treeResp.status === 404) {
      res.status(422).json({
        error: `Branch '${targetBranch}' not found in ${owner}/${repo}. Check the branch name or leave it blank to use the default branch.`,
      });
    } else {
      const errText = await treeResp.text();
      res.status(422).json({ error: `Could not fetch repository tree (${treeResp.status}): ${errText}` });
    }
    return;
  }

  const treeData = (await treeResp.json()) as GithubTreeResponse;
  const backendFiles = treeData.tree
    .filter((item) => item.type === "blob" && isBackendFile(item.path))
    .slice(0, limit);

  if (backendFiles.length === 0) {
    const allPaths = treeData.tree.filter(i => i.type === "blob").map(i => i.path).slice(0, 10).join(", ");
    res.status(422).json({
      error:
        `No supported source files found in ${owner}/${repo} on branch '${targetBranch}'. ` +
        `Supported: .py .ts .js .go .java .kt .rs .rb .php .cs .cpp .c .swift and more. ` +
        (allPaths ? `Files found: ${allPaths}${treeData.tree.length > 10 ? "…" : ""}` : "The repository appears to be empty."),
    });
    return;
  }

  const filePaths = backendFiles.map((f) => f.path);
  const packageStructure = buildFileTree(filePaths);

  const codeParts: string[] = [];
  const batchSize = 10;

  for (let i = 0; i < backendFiles.length; i += batchSize) {
    const batch = backendFiles.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const fileResp = await githubFetch(
          `/repos/${owner}/${repo}/contents/${file.path}?ref=${targetBranch}`,
          githubToken
        );
        if (!fileResp.ok) return null;
        const fileData = (await fileResp.json()) as GithubFileContent;
        if (fileData.encoding === "base64") {
          const decoded = Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf-8");
          const prefix = commentPrefix(file.path);
          return `${prefix} ===== FILE: ${file.path} =====\n${decoded}\n`;
        }
        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        codeParts.push(result.value);
      }
    }
  }

  if (codeParts.length === 0) {
    res.status(422).json({
      error: `Found ${backendFiles.length} source files but could not read any content. This may be a GitHub API rate limit issue — add a token to increase limits.`,
    });
    return;
  }

  const javaCode = codeParts.join("\n");
  const isTruncated = treeData.truncated || backendFiles.length >= limit;

  res.json({
    name: `${owner}/${repo}`,
    javaCode,
    packageStructure,
    fileCount: codeParts.length,
    truncated: isTruncated,
  });
});

function buildFileTree(paths: string[]): string {
  const tree: Record<string, unknown> = {};

  for (const p of paths) {
    const parts = p.split("/");
    let node = tree;
    for (const part of parts) {
      if (!node[part]) {
        node[part] = {};
      }
      node = node[part] as Record<string, unknown>;
    }
  }

  const lines: string[] = [];
  function render(node: Record<string, unknown>, prefix: string) {
    const keys = Object.keys(node).sort();
    keys.forEach((key, i) => {
      const isLast = i === keys.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";
      lines.push(`${prefix}${connector}${key}`);
      const child = node[key] as Record<string, unknown>;
      if (Object.keys(child).length > 0) {
        render(child, prefix + childPrefix);
      }
    });
  }

  render(tree, "");
  return lines.join("\n");
}

export default router;
