# CodeSage
## Proof of Concept Document

*AI-Powered Business Rules & Requirements Extractor*
*Version 1.0 — May 2026*

---

## Introduction

Every software organization carries the same hidden burden: a codebase that does far more than anyone can fully explain. Over months and years, developers write business logic, embed decision rules, and build entire workflows into functions and classes that nobody has ever documented in plain English. When it comes time to audit that system, migrate it, onboard new engineers, or hand it off to a new team, the painful process of reading through thousands of lines of code begins.

CodeSage was built to solve this problem. It is an AI-powered web application that reads any backend code repository and automatically produces a structured, human-readable breakdown of the business rules, data dependencies, microservice boundaries, and functional requirements embedded within it. What would normally take a team of engineers two to four weeks to produce manually, CodeSage delivers in under ten minutes.

---

## The Problem in Plain Terms

Imagine a company that has been running a Python-based billing system for five years. The system handles subscription upgrades, proration calculations, discount logic, invoice generation, and payment retries. This logic is real, it is critical, and it works — but it exists only as code. There is no document that describes what the system does in plain English. There is no diagram that shows which parts own which decisions. There is no boundary that separates the billing rules from the database access code.

Now imagine that company decides to move from a monolith to microservices. Or they bring in an outside compliance team. Or they want to rebuild the system in a new language. In every one of these scenarios, they face the same first step: someone has to read through the code and figure out what it actually does.

This is slow, expensive, and surprisingly error-prone. Important rules get missed. Assumptions get made. The documentation that eventually gets written is already out of date by the time it is finished.

CodeSage eliminates this bottleneck entirely.

---

## System Architecture Diagram

The following diagram shows how all layers of CodeSage connect — from the user's browser through to the AI provider.

```
╔══════════════════════════════════════════════════════════════════════╗
║                          USER'S BROWSER                              ║
║                                                                      ║
║   ┌─────────────┐   ┌──────────────────┐   ┌──────────────────────┐ ║
║   │   Sidebar   │   │  Repositories    │   │   Results / Stream   │ ║
║   │  (Sessions) │   │  (GitHub/Paste)  │   │   (Live SSE view)    │ ║
║   └─────────────┘   └──────────────────┘   └──────────────────────┘ ║
║                                                                      ║
║   React 18 · Vite 7 · TypeScript · TanStack Query · Tailwind CSS    ║
╚══════════════════════╦═══════════════════════════════════════════════╝
                       ║  HTTP / Server-Sent Events (SSE)
╔══════════════════════╩═══════════════════════════════════════════════╗
║                       EXPRESS API SERVER                             ║
║                     Node.js · TypeScript                             ║
║                                                                      ║
║   ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐   ║
║   │  /github/fetch   │  │  /analyses/*    │  │ /analyze/:id/    │   ║
║   │  GitHub import   │  │  CRUD sessions  │  │ full  (pipeline) │   ║
║   └────────┬─────────┘  └────────┬────────┘  └────────┬─────────┘   ║
║            │                     │                     │             ║
╚════════════╪═════════════════════╪═════════════════════╪═════════════╝
             │                     │                     │
             ▼                     ▼                     ▼
╔════════════════════╗   ╔═════════════════╗   ╔════════════════════╗
║   GITHUB REST API  ║   ║   POSTGRESQL    ║   ║    OPENROUTER      ║
║                    ║   ║                 ║   ║                    ║
║  • Repo tree       ║   ║  analyses       ║   ║  Model:            ║
║  • File contents   ║   ║  repositories   ║   ║  nvidia/nemotron   ║
║  • Branch info     ║   ║  results        ║   ║  -3-super-120B     ║
║                    ║   ║  (Drizzle ORM)  ║   ║  (free tier)       ║
╚════════════════════╝   ╚═════════════════╝   ╚════════════════════╝
```

---

## GitHub Import Flow

When a user submits a GitHub URL, the following sequence of steps runs on the server before a single line of code reaches the AI:

```
User submits GitHub URL
         │
         ▼
┌─────────────────────────────────────┐
│  Parse URL                          │
│  Extract: owner / repo / branch     │
│  Supports all formats:              │
│  • github.com/owner/repo            │
│  • github.com/owner/repo/tree/main  │
│  • git@github.com:owner/repo.git    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  No branch in URL?                  │
│  → Call GitHub API: GET /repos      │
│    to fetch default_branch          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Fetch full file tree               │
│  GET /repos/:owner/:repo/git/trees  │
│  /:branch?recursive=1               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Fetch file contents                │
│  Decode base64 → UTF-8 text         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Concatenate all files              │
│  Build directory tree structure     │
│  Store in PostgreSQL                │
│  Return to frontend                 │
└─────────────────────────────────────┘
```

**Error handling at each stage:**

```
URL invalid            → "Invalid GitHub URL. Expected: github.com/owner/repo"
Repo not found (404)   → "Repository not found. Check spelling or add a token."
Auth failed (401)      → "GitHub authentication failed. Provide a valid PAT token."
Rate limited (403)     → "GitHub API rate limit reached. Add a token to increase limits."
Branch not found       → "Branch 'xyz' not found. Check the branch name."
No source files found  → "No supported files found. Files seen: [list]"
Files unreadable       → "Found N files but couldn't read content. Possible rate limit."
```

---

## The Six-Step AI Pipeline

Each step is a separate call to the language model. The results accumulate and are passed forward as context. Steps 1–3 include the source code. Steps 4–6 work only from the prior analysis, keeping prompt sizes manageable.

```
                    ┌─────────────────────────────┐
                    │       SOURCE CODE            │
                    │  (stored in PostgreSQL)      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │         STEP 1               │
                    │   Repository Discovery       │◄─── Full source code
                    │                             │
                    │  Output:                    │
                    │  • File inventory table     │
                    │  • Class & function list    │
                    │  • Third-party dependencies │
                    │  • Codebase summary         │
                    └──────────────┬──────────────┘
                                   │ Step 1 output
                    ┌──────────────▼──────────────┐
                    │         STEP 2               │
                    │  Business Logic              │◄─── Full source code
                    │  Classification              │◄─── Step 1 results
                    │                             │
                    │  Output: Every function      │
                    │  labelled as one of:         │
                    │  ✅ Business Rule            │
                    │  ✅ Orchestration            │
                    │  ❌ Data Access (excluded)   │
                    │  ❌ Infrastructure (excluded) │
                    │  ❌ UI (excluded)            │
                    └──────────────┬──────────────┘
                                   │ Steps 1–2 output
                    ┌──────────────▼──────────────┐
                    │         STEP 3               │
                    │  Business Rule Extraction    │◄─── Full source code
                    │                             │◄─── Steps 1–2 results
                    │  For each ✅ function:       │
                    │  • Plain-English description │
                    │  • Inputs & outputs          │
                    │  • Edge cases & conditions   │
                    │  • Suggested owning service  │
                    └──────────────┬──────────────┘
                                   │ Steps 1–3 output
                    ┌──────────────▼──────────────┐
                    │         STEP 4               │
                    │  Memory & State              │◄─── Steps 1–3 results only
                    │  Dependency Map              │     (no code re-send)
                    │                             │
                    │  Output: Every global var,  │
                    │  cache, shared state with   │
                    │  migration recommendation   │
                    └──────────────┬──────────────┘
                                   │ Steps 1–4 output
                    ┌──────────────▼──────────────┐
                    │         STEP 5               │
                    │  Microservice Grouping       │◄─── Steps 1–4 results only
                    │  Proposal (DDD)              │     (no code re-send)
                    │                             │
                    │  Output: Service boundaries, │
                    │  API contracts, dependency  │
                    │  graph between services      │
                    └──────────────┬──────────────┘
                                   │ All prior results
                    ┌──────────────▼──────────────┐
                    │         STEP 6               │
                    │  Requirements Document       │◄─── All prior results only
                    │                             │     (no code re-send)
                    │  Output: Executive summary, │
                    │  functional requirements,   │
                    │  business rules (plain eng),│
                    │  API contracts, flagged ⚠️  │
                    └─────────────────────────────┘
```

---

## End-to-End User Flow

This is the complete journey from a user opening CodeSage to receiving a finished requirements document:

```
  USER                    FRONTEND                  API SERVER              EXTERNAL
   │                         │                          │                      │
   │  Open CodeSage          │                          │                      │
   │────────────────────────►│                          │                      │
   │                         │  GET /api/analyses       │                      │
   │                         │─────────────────────────►│                      │
   │                         │  [ ] empty list          │                      │
   │◄────────────────────────│◄─────────────────────────│                      │
   │                         │                          │                      │
   │  Click "New Analysis"   │                          │                      │
   │────────────────────────►│                          │                      │
   │  Enter session name     │  POST /api/analyses      │                      │
   │                         │─────────────────────────►│                      │
   │                         │  { id: 1, status:        │                      │
   │◄────────────────────────│◄── "pending" }           │                      │
   │  Redirect to /analysis/1│                          │                      │
   │                         │                          │                      │
   │  Paste GitHub URL       │                          │                      │
   │────────────────────────►│                          │                      │
   │  Click "Import"         │  POST /api/github/fetch  │                      │
   │                         │─────────────────────────►│  GET /repos tree     │
   │                         │                          │─────────────────────►│
   │                         │                          │  GET /contents x60   │
   │                         │                          │◄─────────────────────│
   │                         │  POST /analyses/1/repos  │                      │
   │                         │─────────────────────────►│  INSERT to DB        │
   │◄────────────────────────│◄── { fileCount: 47 }     │                      │
   │  See repo card appear   │                          │                      │
   │                         │                          │                      │
   │  Click "Run Analysis"   │                          │                      │
   │────────────────────────►│  POST /analyze/1/full    │                      │
   │                         │─────────────────────────►│                      │
   │                         │                          │                      │
   │  ┌─ STEP 1 starts ─┐   │◄── SSE: stepTransition   │                      │
   │  │ tokens stream   │◄──│◄── SSE: content chunks   │──► OpenRouter API    │
   │  │ in real time    │   │                          │◄── stream tokens      │
   │  └─────────────────┘   │◄── SSE: stepComplete     │   save to DB         │
   │                         │                          │                      │
   │  ┌─ STEP 2 starts ─┐   │◄── SSE: stepTransition   │                      │
   │  │ tokens stream   │◄──│◄── SSE: content chunks   │──► OpenRouter API    │
   │  └─────────────────┘   │◄── SSE: stepComplete     │◄── stream tokens     │
   │                         │                          │   save to DB         │
   │       ... steps 3, 4, 5 follow the same pattern ...│                      │
   │                         │                          │                      │
   │  ┌─ STEP 6 done ───┐   │◄── SSE: done             │                      │
   │  │ Results tab     │   │  invalidate queries       │                      │
   │  │ fully rendered  │   │  GET /analyses/1/results  │                      │
   │  └─────────────────┘   │─────────────────────────►│  SELECT from DB      │
   │◄────────────────────────│◄── all 6 step results    │                      │
   │  Download / share       │                          │                      │
```

---

## Prompt Optimization Strategy

One of the most important engineering decisions in the pipeline is how context is managed across the six steps. Naively passing everything to every step would make later prompts enormous and slow.

```
Step  │ Source Code Sent │ Prior Results Sent │ Approx. Prompt Size
──────┼──────────────────┼────────────────────┼────────────────────
  1   │      ✅ Yes      │       None         │  ~15,000 tokens
  2   │      ✅ Yes      │    Step 1 only     │  ~20,000 tokens
  3   │      ✅ Yes      │    Steps 1–2       │  ~25,000 tokens
  4   │      ❌ No       │    Steps 1–3       │  ~12,000 tokens
  5   │      ❌ No       │    Steps 1–4       │  ~16,000 tokens
  6   │      ❌ No       │    Steps 1–5       │  ~20,000 tokens
```

By step four the model has already fully processed the source code in three prior passes. Re-sending it would double the prompt size with no gain in quality. This optimization cuts token usage for the second half of the pipeline by more than fifty percent.

---

## Technical Architecture

CodeSage is built as a full-stack TypeScript monorepo managed with pnpm workspaces. The frontend is a React application built with Vite, styled with Tailwind CSS, and powered by TanStack React Query for server state management. The backend is an Express API server running on Node.js. Data is stored in a managed PostgreSQL database using Drizzle ORM as the data access layer.

The AI layer uses the OpenAI-compatible SDK pointed at OpenRouter, which provides access to a wide range of open-source and commercial language models through a single API. The current model in use is NVIDIA's Nemotron 3 Super 120B, a free-tier model with strong reasoning capabilities for structured analysis tasks.

Communication between the frontend and the AI pipeline uses Server-Sent Events rather than WebSockets. This choice keeps the implementation simple and stateless while giving users the real-time streaming experience they would expect from a modern AI application.

All analysis results are persisted to PostgreSQL as each step completes, meaning the system is resilient to network interruptions and page reloads. A user can close their browser mid-analysis and return later to find everything intact.

---

## Safeguards and Reliability

Several engineering decisions were made specifically to ensure the system handles real-world use cases gracefully.

The Express server accepts request bodies up to fifty megabytes, which accommodates even large repositories without crashing. The default file cap of sixty files balances thoroughness against prompt size, keeping individual API calls within a range that free-tier models can handle reliably.

GitHub token handling is deliberately conservative. The system never uses an environment-level GitHub token as a fallback for unauthenticated requests, because an expired or invalid server-side token would silently break access to public repositories. A token is only sent to GitHub if the user explicitly provides one in the interface.

Error messages from the GitHub integration are specific and actionable. Rather than a generic failure notice, users see messages that distinguish between an invalid URL, a repository that does not exist, a branch that was not found, a rate limit that has been reached, and an authentication failure for a private repository.

The model is capped at four thousand tokens of output per step. This is still more than enough for thorough analysis while preventing runaway generation that would slow down the pipeline unnecessarily.

---

## What the Output Looks Like

By the time the pipeline completes, the user has six structured sections covering every dimension of their codebase from a business perspective. The final requirements document, which is the most shareable artifact, reads like something a senior architect and a technical writer produced together. It can be copied into a Confluence page, pasted into a Jira epic, or handed directly to a product manager.

The flagged items section is particularly valuable in practice. Any function whose business purpose was unclear, any rule that appeared to mix domain logic with data access, or any threshold constant whose meaning was ambiguous will be marked with a human review notice and a brief explanation of what the model was uncertain about. This gives the review team a focused list of questions rather than asking them to read everything themselves.

---

## Current Limitations

The POC uses a free-tier language model, which means response times are subject to the OpenRouter queue. During peak hours, each step may take between thirty and ninety seconds to start generating. A production deployment using a paid model such as GPT-4o Mini or Claude Haiku would reduce total analysis time to under two minutes.

The sixty-file cap means that very large monorepos with hundreds of source files will only be partially analyzed. For those cases, the intended workflow is for the user to identify the most critical subset of the codebase and import it selectively.

The system currently produces Markdown output only. Export to PDF, Word, or direct integration with project management tools such as Jira and Confluence is on the roadmap for the next phase of development.

---

## Why This Approach Works

The core insight behind CodeSage is that modern large language models are extraordinarily good at reading code and explaining it in human terms. They have been trained on billions of lines of open-source code across dozens of languages, and they understand not just the syntax but the intent behind common patterns. What they struggle with is knowing which parts of a codebase are important without being guided. The six-step pipeline solves this by structuring the analysis in the same order a senior architect would naturally approach it: understand the structure first, classify the components, extract the rules, map the dependencies, propose the boundaries, then write the documentation.

Each step sharpens the focus for the next. By the time the model is writing the requirements document, it has already done all of the hard analytical work and is simply translating its conclusions into plain English. The result is consistently more accurate and more complete than what you would get from asking a general-purpose chatbot to analyze the same codebase in a single prompt.

---

## Roadmap

The immediate next priorities are exporting results as PDF documents, adding support for paid model providers to reduce analysis time, and building a multi-repo mode that can analyze a cluster of microservices together and produce a unified architecture overview.

Medium-term priorities include direct integration with Jira to push requirements as epics and stories, a diff mode that compares two versions of a codebase and highlights which business rules changed, and a webhook trigger that automatically runs an analysis whenever new code is pushed to a repository.

Longer-term, the most valuable evolution of the product would be a fine-tuned model specifically trained on enterprise codebase analysis, which would produce more consistent and domain-specific output than a general-purpose foundation model.

---

## Tech Stack Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      CODESAGE STACK                         │
├─────────────────┬───────────────────────────────────────────┤
│ Frontend        │ React 18 · Vite 7 · TypeScript            │
│                 │ Tailwind CSS v4 · shadcn/ui               │
│                 │ TanStack React Query · Framer Motion       │
│                 │ Wouter (routing) · Lucide icons            │
├─────────────────┼───────────────────────────────────────────┤
│ Backend         │ Node.js · Express · TypeScript            │
│                 │ Server-Sent Events (SSE)                   │
├─────────────────┼───────────────────────────────────────────┤
│ Database        │ PostgreSQL (managed)                       │
│                 │ Drizzle ORM                                │
├─────────────────┼───────────────────────────────────────────┤
│ AI Provider     │ OpenRouter (openrouter.ai)                 │
│                 │ OpenAI-compatible SDK                      │
│ Model           │ nvidia/nemotron-3-super-120B:free          │
│ Max tokens/step │ 4,096                                      │
├─────────────────┼───────────────────────────────────────────┤
│ Infrastructure  │ Replit (monorepo hosting)                  │
│ Package Manager │ pnpm workspaces                            │
│ Language        │ TypeScript throughout (frontend + backend) │
└─────────────────┴───────────────────────────────────────────┘
```

---

## Summary

CodeSage demonstrates that the combination of structured prompting, a multi-step AI pipeline, and persistent session management can compress weeks of manual documentation work into a single automated run. The proof of concept is fully functional, handles real GitHub repositories across more than twenty programming languages, and produces output that is immediately useful to engineers, architects, and non-technical stakeholders alike.

The foundation is in place. The path to a production-grade product is well-defined. And the problem it solves — the gap between what code does and what anyone can explain about it — is one that every software organization faces every day.

---

*CodeSage Proof of Concept — May 2026*
