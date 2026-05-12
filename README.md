# CodeSage

**AI-powered business rules & requirements extractor for any backend codebase**

CodeSage connects to any GitHub repository (or accepts pasted source code) and runs it through a 6-step AI pipeline that produces a complete, structured breakdown of business rules, data dependencies, microservice boundaries, and stakeholder-ready requirements — in minutes instead of weeks.

---

## What It Does

| Step | Name | Output |
|------|------|--------|
| 1 | Repository Discovery | File inventory, class/function list, third-party dependencies, codebase summary |
| 2 | Business Logic Classification | Every function labelled: Business Rule / Orchestration / Data Access / Infrastructure / UI |
| 3 | Business Rule Extraction | Plain-English rule descriptions with inputs, outputs, edge cases, suggested owning service |
| 4 | Memory & State Dependency Map | Every global variable, cache, shared state — with migration recommendation |
| 5 | Microservice Grouping Proposal | Service boundaries, API contracts, dependency graph (Domain-Driven Design) |
| 6 | Requirements Document | Executive summary, functional requirements, business rules, API contracts, flagged items |

---

## Supported Languages

Python · Go · Java · Kotlin · Scala · Rust · C# · C · C++ · Ruby · PHP · TypeScript · JavaScript · Swift · Elixir · Erlang · Haskell · Dart · Lua · Clojure · SQL · GraphQL · Protocol Buffers · Shell scripts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 7, TypeScript, Tailwind CSS v4 |
| UI | shadcn/ui, Framer Motion, TanStack React Query, Wouter |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| AI Provider | OpenRouter (OpenAI-compatible API) |
| AI Model | nvidia/nemotron-3-super-120B:free |
| Streaming | Server-Sent Events (SSE) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
codesage/
├── artifacts/
│   ├── api-server/          # Express API server (TypeScript)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── analyze.ts   # 6-step AI pipeline (SSE streaming)
│   │       │   ├── github.ts    # GitHub repo import & file filtering
│   │       │   └── analyses.ts  # Session & repository CRUD
│   │       ├── app.ts           # Express app setup
│   │       └── index.ts         # Server entry point
│   │
│   └── java-modernization/  # React frontend (Vite)
│       └── src/
│           ├── pages/
│           │   ├── Home.tsx          # Session dashboard
│           │   └── AnalysisDetail.tsx # Analysis workspace
│           ├── components/analysis/
│           │   ├── RepositoriesTab.tsx  # GitHub import / code paste
│           │   ├── RunAnalysisTab.tsx   # Run pipeline, live stream
│           │   └── ResultsTab.tsx       # View & download results
│           └── hooks/
│               └── use-analysis-stream.ts  # SSE client hook
│
├── lib/
│   ├── db/                  # Drizzle ORM schema + DB connection
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   └── api-zod/             # Generated Zod schemas
│
├── codesage-poc.md          # Full POC document with architecture diagrams
└── pnpm-workspace.yaml
```

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database (set `DATABASE_URL` env var)
- OpenRouter API key (set `OPENROUTER_API_KEY` env var)

### Install dependencies

```bash
pnpm install
```

### Run database migrations

```bash
pnpm --filter @workspace/db run push
```

### Start the API server

```bash
pnpm --filter @workspace/api-server run dev
```

### Start the frontend

```bash
pnpm --filter @workspace/java-modernization run dev
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI model access |
| `PORT` | Yes | Port for the API server |
| `GITHUB_TOKEN` | No | GitHub PAT for importing private repositories |

---

## How It Works

### GitHub Import

1. Paste any GitHub URL — with or without a branch (`/tree/branchname`)
2. Server fetches the full file tree via the GitHub API
3. The concatenated code is stored in PostgreSQL

### AI Pipeline

Each of the 6 steps is a separate call to the language model via OpenRouter. Steps build on each other — the output of each step is passed as context to the next. Steps 1–3 include the full source code; Steps 4–6 work only from prior analysis results (reducing prompt size by over 50% for the second half of the pipeline).

Results are saved to PostgreSQL as each step completes, so sessions survive page reloads.

### Guardrails

- Express body limit raised to 50 MB for large repositories
- `max_tokens: 4096` per step to prevent runaway generation
- GitHub token only sent if user explicitly provides one (never falls back to environment token)
- Specific, actionable error messages for every GitHub API failure mode
- Steps 4–6 do not re-embed raw source code (prompt optimization)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/github/fetch` | Fetch and filter files from a GitHub repo |
| GET | `/api/analyses` | List all analysis sessions |
| POST | `/api/analyses` | Create a new session |
| GET | `/api/analyses/:id` | Get session details |
| DELETE | `/api/analyses/:id` | Delete a session |
| GET | `/api/analyses/:id/repositories` | List repositories in a session |
| POST | `/api/analyses/:id/repositories` | Add a repository to a session |
| DELETE | `/api/analyses/:id/repositories/:repoId` | Remove a repository |
| GET | `/api/analyses/:id/results` | Get all step results |
| POST | `/api/analyze/:id/full` | Run all 6 steps (SSE stream) |
| POST | `/api/analyze/:id/step/:step` | Run a single step (SSE stream) |

---

## Roadmap

- [ ] Export results as PDF / Word
- [ ] Paid model support (GPT-4o, Claude) for faster runs
- [ ] Multi-repo cross-analysis (microservice mesh)
- [ ] Jira / Confluence direct integration
- [ ] Diff mode — highlight what changed between two versions
- [ ] GitHub webhook trigger on push
- [ ] Fine-tuned model for enterprise codebase analysis

---

## License

MIT
