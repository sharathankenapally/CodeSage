# CodeSage — Proof of Concept

**AI-Powered Business Rules & Requirements Extractor**
**Version:** 1.0 | **Date:** May 2026 | **Status:** Working Prototype

---

## 1. Problem Statement

Legacy and modern backend codebases often lack up-to-date documentation. When organizations want to:
- Migrate a monolith to microservices
- Onboard new developers quickly
- Audit business logic for compliance
- Rebuild or modernize a system

...they face the same challenge: **the real business rules live only in the code**, buried under layers of infrastructure, data access, and framework boilerplate. Extracting them manually is slow, expensive, and error-prone.

> A typical 50,000-line backend codebase can take a team of engineers **2–4 weeks** to document manually.

---

## 2. Solution Overview

CodeSage connects to any GitHub repository (or accepts pasted code) and automatically:

1. Discovers every module, class, and function
2. Classifies code into business logic vs. infrastructure
3. Extracts human-readable business rules
4. Maps in-memory state and data dependencies
5. Proposes microservice boundaries using Domain-Driven Design
6. Generates a complete, stakeholder-ready requirements document

**Time to complete:** 3–8 minutes (vs. weeks manually)

---

## 3. Supported Languages

| Language | Extensions |
|----------|-----------|
| Python | `.py`, `.pyw` |
| Go | `.go` |
| Java | `.java` |
| Kotlin | `.kt`, `.kts` |
| Rust | `.rs` |
| C# | `.cs` |
| C / C++ | `.c`, `.cpp`, `.cc`, `.h` |
| Ruby | `.rb`, `.rake` |
| PHP | `.php` |
| TypeScript | `.ts` |
| JavaScript | `.js`, `.mjs` |
| Swift | `.swift` |
| Elixir | `.ex`, `.exs` |
| Scala | `.scala` |
| SQL | `.sql` |
| Shell | `.sh`, `.bash` |
| GraphQL / Proto | `.graphql`, `.proto` |
| + more | Dart, Lua, Haskell, Clojure, Erlang |

---

## 4. Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        USER BROWSER                      │
│                                                         │
│  React + Vite + TypeScript + TanStack Query             │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ Sessions │  │  Repos    │  │  Live Streaming       │  │
│  │ Sidebar  │  │  Import   │  │  Results (SSE)        │  │
│  └──────────┘  └───────────┘  └──────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│                   EXPRESS API SERVER                     │
│                   Node.js + TypeScript                   │
│                                                         │
│  /api/github/fetch  ──► GitHub REST API                 │
│  /api/analyses/*    ──► PostgreSQL (Drizzle ORM)        │
│  /api/analyze/:id/full ──► 6-Step AI Pipeline (SSE)    │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │        POSTGRESQL DB         │
          │  analyses | repositories |   │
          │  analysis_results            │
          └──────────────┬──────────────┘
                         │
          ┌──────────────▼──────────────┐
          │         OPENROUTER           │
          │  Model: nvidia/nemotron-     │
          │  3-super-120B (free tier)    │
          │  Protocol: OpenAI-compatible │
          └─────────────────────────────┘
```

---

## 5. The 6-Step AI Pipeline

Each step is an independent LLM call. Prior step outputs are passed as context to subsequent steps, building a cumulative understanding.

```
Step 1 — Repository Discovery
  Input:  Raw source code (up to 60 files)
  Output: Module inventory table, key imports, codebase summary

Step 2 — Business Logic Classification
  Input:  Source code + Step 1 results
  Output: Every function labelled (Business Rule / Orchestration /
          Data Access / Infrastructure / UI)

Step 3 — Business Rule Extraction
  Input:  Source code + Steps 1–2 results
  Output: Plain-English rule descriptions with inputs, outputs,
          edge cases, and suggested owning service

Step 4 — Memory & State Dependency Map
  Input:  Steps 1–3 results (no code re-send)
  Output: Every global variable, cache, shared state — with
          migration recommendation (Redis / DB / pass as arg)

Step 5 — Microservice Grouping Proposal
  Input:  Steps 1–4 results (no code re-send)
  Output: Service boundaries, API contracts, dependency graph

Step 6 — Requirements Document
  Input:  All prior results (no code re-send)
  Output: Executive summary, functional requirements, business
          rules, data requirements, API contracts, flagged items
```

---

## 6. Guardrails & Safety

| Risk | Guardrail |
|------|-----------|
| Server crash on large repos | Express body limit: 50 MB |
| Test / config file noise | 15+ ignore patterns (node_modules, vendor, test files, lock files, config files) |
| UI code diluting analysis | Frontend extensions (.tsx, .jsx, .vue, .css) explicitly excluded |
| Invalid GitHub URL | Server-side regex parser with specific error messages per failure mode |
| Token abuse on free model | `max_tokens: 4096` cap per step |
| Prompt bloat in later steps | Steps 4–6 work from prior analysis only, not raw code |
| Lost analysis on disconnect | All results persisted to PostgreSQL; sessions resume on reload |
| GitHub rate limiting | Supports user-provided PAT token; clear rate-limit error shown |
| Private repos | Collapsible token input; auth only sent when token is explicitly provided |

---

## 7. Key Metrics (POC Benchmarks)

| Metric | Result |
|--------|--------|
| Languages supported | 20+ |
| Files processed per run | Up to 60 |
| Average analysis time (medium repo) | 4–7 min |
| Steps in pipeline | 6 |
| Streaming latency to browser | Real-time (SSE) |
| Persistence | PostgreSQL — sessions survive page reload |
| Concurrent sessions | Unlimited (stateless API) |

---

## 8. Sample Output (Step 6 excerpt)

```markdown
# Codebase Requirements Report

## Executive Summary
The Payment Service is a Python backend that handles subscription billing,
proration calculations, and invoice generation. It enforces three core
business rules: maximum discount thresholds, grace period logic for failed
payments, and multi-currency rounding policy.

# Requirements: BillingService

## Functional Requirements
1. Calculate prorated charges when a subscription is upgraded mid-cycle
2. Apply a maximum discount of 40% on any single invoice line
3. Retry failed payments up to 3 times before suspending the account
4. Generate PDF invoices in the customer's billing currency

## Business Rules
1. **ProrationRule** — When a plan upgrade occurs, charge only for the
   remaining days in the billing cycle at the new plan rate.
2. **MaxDiscountRule** — No discount coupon may reduce a line item below
   60% of its list price. Excess discount is silently capped.
```

---

## 9. Differentiators

| Feature | CodeSage | Manual Review | Generic LLM Chat |
|---------|----------|--------------|-----------------|
| Multi-language | ✅ 20+ languages | ✅ | ⚠️ Prompt-dependent |
| Structured output | ✅ Always | ❌ Varies | ❌ Varies |
| Microservice proposals | ✅ DDD-based | ⚠️ Expert required | ❌ |
| Session persistence | ✅ PostgreSQL | N/A | ❌ |
| Real-time streaming | ✅ SSE | N/A | ⚠️ Some |
| GitHub direct import | ✅ Any public repo | ❌ Manual clone | ❌ |
| Time to output | 3–8 min | 2–4 weeks | Hours |

---

## 10. Limitations (Current POC)

- Free-tier model (Nemotron 120B) has queue-based latency; paid model would reduce analysis to under 2 minutes
- File cap of 60 files per repo (configurable); very large monorepos need selective import
- No support for binary files, notebooks (`.ipynb`), or template languages
- Analysis is read-only — no code generation or refactoring output yet

---

## 11. Roadmap

| Priority | Feature |
|----------|---------|
| High | Export results as PDF / Word |
| High | Paid model support (GPT-4o, Claude) for faster runs |
| Medium | Multi-repo cross-analysis (microservice mesh) |
| Medium | Jira / Confluence integration — push requirements directly |
| Medium | Diff mode — re-analyze after code changes, show what changed |
| Low | Webhook trigger on GitHub push |
| Low | Fine-tuned model on enterprise codebases |

---

## 12. Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, Vite 7, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/ui, Framer Motion, Lucide icons |
| State Management | TanStack React Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| AI Provider | OpenRouter (OpenAI-compatible API) |
| AI Model | nvidia/nemotron-3-super-120B:free |
| Streaming | Server-Sent Events (SSE) |
| Package Management | pnpm workspaces (monorepo) |
| Hosting | Replit (development + deployment) |

---

*CodeSage POC — Built to demonstrate AI-assisted codebase intelligence at scale.*
