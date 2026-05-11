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

## What CodeSage Does

The application accepts a GitHub repository URL or a block of pasted source code. It connects to GitHub's API, pulls down all relevant backend source files, filters out noise such as test files, configuration files, and framework boilerplate, and feeds the real application code into a six-step AI analysis pipeline.

Each step of the pipeline is handled by a large language model that has been prompted to perform a specific type of analysis. The steps build on each other — the output of step one becomes part of the input for step two, and so on. By the time the pipeline finishes, the user has a complete, structured document covering every significant aspect of the codebase from a business perspective.

The entire process happens in the browser with real-time streaming. Users watch the analysis unfold token by token, step by step, rather than staring at a loading screen. Every result is saved to a database, so sessions persist across page loads and users can return to review or share their findings at any time.

---

## The Six Analysis Steps

**Step 1 — Repository Discovery**

The first step gives the model a full view of what it is working with. It produces a structured table listing every source file, its purpose, and how many functions and classes it contains. It identifies the third-party libraries and frameworks the codebase depends on. It ends with a plain-language summary of what the system does overall. This step is the foundation that all subsequent steps are built upon.

**Step 2 — Business Logic Classification**

Not all code is equal from a business perspective. A function that validates whether a discount exceeds a maximum threshold is a business rule. A function that queries the database to retrieve a customer record is infrastructure. Step two goes through every function and method found in step one and assigns it a category: Business Rule, Orchestration, Data Access, Infrastructure, or UI. Only the first two categories are carried forward into the deeper analysis. Everything else is acknowledged and set aside.

**Step 3 — Business Rule Extraction**

This is the heart of the pipeline. For every function classified as a business rule or orchestration logic in step two, the model produces a structured entry that describes the rule in plain English — what it does, what inputs it requires, what decision or output it produces, and what edge cases or conditions it handles. Each rule is also tagged with a suggested owning service, which feeds directly into the microservice grouping in step five.

**Step 4 — Memory and State Dependency Map**

Modern systems often carry hidden complexity in the form of global variables, in-memory caches, module-level dictionaries, and singleton objects. These are the kinds of things that break apart when a monolith is split into services, because suddenly the shared state that everything depended on no longer exists in a single process. Step four identifies every piece of in-memory state in the codebase, explains what depends on it, and recommends how it should be handled in a distributed architecture — whether that means moving it to a Redis cache, persisting it in a database table, or restructuring it to be passed as a function argument.

**Step 5 — Microservice Grouping Proposal**

Using the business rules from step three and the state map from step four, the model proposes a set of logical service boundaries grounded in Domain-Driven Design principles. Each proposed service is described with a clear statement of its responsibility, the business rules it owns, the data it requires, the APIs it would expose, and its dependencies on other services. The step ends with a plain-text dependency graph showing how the proposed services relate to each other.

**Step 6 — Requirements Document**

The final step synthesizes everything into a formal requirements document written in plain English, with no code and no technical implementation details. This is the document that a product manager, a compliance officer, or a new engineering team can read and immediately understand. It includes an executive summary, functional requirements organized by service, business rule descriptions, data requirements, API contracts, and a section flagging any areas where human judgment is needed because the code's intent was ambiguous.

---

## Technical Architecture

CodeSage is built as a full-stack TypeScript monorepo managed with pnpm workspaces. The frontend is a React application built with Vite, styled with Tailwind CSS, and powered by TanStack React Query for server state management. The backend is an Express API server running on Node.js. Data is stored in a managed PostgreSQL database using Drizzle ORM as the data access layer.

The AI layer uses the OpenAI-compatible SDK pointed at OpenRouter, which provides access to a wide range of open-source and commercial language models through a single API. The current model in use is NVIDIA's Nemotron 3 Super 120B, a free-tier model with strong reasoning capabilities for structured analysis tasks.

Communication between the frontend and the AI pipeline uses Server-Sent Events rather than WebSockets. This choice keeps the implementation simple and stateless while giving users the real-time streaming experience they would expect from a modern AI application.

All analysis results are persisted to PostgreSQL as each step completes, meaning the system is resilient to network interruptions and page reloads. A user can close their browser mid-analysis and return later to find everything intact.

---

## GitHub Integration

When a user provides a GitHub URL, the server parses it to extract the repository owner, repository name, and optional branch name. It supports every common GitHub URL format, including URLs that embed the branch in a `/tree/branchname` path. It then calls the GitHub API to retrieve the complete file tree of the repository.

Before any file is read, a filtering pass removes everything that does not belong in a business logic analysis. This includes all test files, configuration files, lock files, build output directories, third-party vendor directories, generated code, and UI component files. Only genuine backend source files proceed to the next stage.

Up to sixty files are then fetched in parallel batches of ten, each prefixed with a comment that tells the AI which file it is reading. This structured labeling means the model understands the file layout and can reference specific files in its analysis. The resulting code is stored in the database and used as the input to the pipeline.

The system supports more than twenty backend languages, covering Python, Go, Java, Kotlin, Scala, Rust, C#, C, C++, Ruby, PHP, TypeScript, JavaScript, Swift, Elixir, Erlang, Haskell, Dart, Lua, Clojure, Shell scripts, SQL, GraphQL schema files, and Protocol Buffer definitions.

---

## Safeguards and Reliability

Several engineering decisions were made specifically to ensure the system handles real-world use cases gracefully.

The Express server accepts request bodies up to fifty megabytes, which accommodates even large repositories without crashing. The default file cap of sixty files balances thoroughness against prompt size, keeping individual API calls within a range that free-tier models can handle reliably.

GitHub token handling is deliberately conservative. The system never uses an environment-level GitHub token as a fallback for unauthenticated requests, because an expired or invalid server-side token would silently break access to public repositories. A token is only sent to GitHub if the user explicitly provides one in the interface.

Error messages from the GitHub integration are specific and actionable. Rather than a generic failure notice, users see messages that distinguish between an invalid URL, a repository that does not exist, a branch that was not found, a rate limit that has been reached, and an authentication failure for a private repository.

Steps four, five, and six of the pipeline do not re-send the raw source code to the model. By that point in the analysis the code has already been fully processed, and including it again would dramatically increase the size and cost of each subsequent prompt without improving the output quality. This optimization alone reduces the token count for the second half of the pipeline by more than fifty percent.

The model is capped at four thousand tokens of output per step. This is still more than enough for thorough analysis while preventing runaway generation that would slow down the pipeline unnecessarily.

---

## What the Output Looks Like

By the time the pipeline completes, the user has six structured sections covering every dimension of their codebase from a business perspective. The final requirements document, which is the most shareable artifact, reads like something a senior architect and a technical writer produced together. It can be downloaded as Markdown, copied into a Confluence page, pasted into a Jira epic, or handed directly to a product manager.

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

## Summary

CodeSage demonstrates that the combination of structured prompting, a multi-step AI pipeline, and persistent session management can compress weeks of manual documentation work into a single automated run. The proof of concept is fully functional, handles real GitHub repositories across more than twenty programming languages, and produces output that is immediately useful to engineers, architects, and non-technical stakeholders alike.

The foundation is in place. The path to a production-grade product is well-defined. And the problem it solves — the gap between what code does and what anyone can explain about it — is one that every software organization faces every day.

---

*CodeSage Proof of Concept — May 2026*
