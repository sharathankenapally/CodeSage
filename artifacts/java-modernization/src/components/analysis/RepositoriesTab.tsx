import { useState } from "react";
import { useRepositories, useCreateRepository, useDeleteRepository } from "@/hooks/use-repositories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FileCode, Trash2, Plus, Code, Github,
  AlertCircle, CheckCircle2, Loader2, FolderGit2, ArrowRight, X, Lock, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const pasteSchema = z.object({
  name: z.string().min(1, "Repository name is required"),
  javaCode: z.string().min(10, "Source code is required"),
  packageStructure: z.string().optional(),
});

type PasteForm = z.infer<typeof pasteSchema>;

interface GithubFetchResult {
  name: string;
  javaCode: string;
  packageStructure: string;
  fileCount: number;
  truncated: boolean;
}

interface GithubEntry {
  url: string;
  branch: string;
  token: string;
  showToken: boolean;
  status: "idle" | "fetching" | "fetched" | "error" | "saved";
  result?: GithubFetchResult;
  error?: string;
}

interface Props {
  analysisId: number;
  onRepoAdded?: () => void;
}

export function RepositoriesTab({ analysisId, onRepoAdded }: Props) {
  const { data: repos, isLoading } = useRepositories(analysisId);
  const createMutation = useCreateRepository(analysisId);
  const deleteMutation = useDeleteRepository(analysisId);
  const { toast } = useToast();

  const [addMode, setAddMode] = useState<"none" | "github" | "paste">("none");
  const [entries, setEntries] = useState<GithubEntry[]>([
    { url: "", branch: "", token: "", showToken: false, status: "idle" },
  ]);
  const [justSavedCount, setJustSavedCount] = useState(0);

  const pasteForm = useForm<PasteForm>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { name: "", javaCode: "", packageStructure: "" },
  });

  /* ── GitHub helpers ── */
  const updateEntry = (idx: number, patch: Partial<GithubEntry>) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };

  const addUrlRow = () => {
    setEntries(prev => [...prev, { url: "", branch: "", token: "", showToken: false, status: "idle" }]);
  };

  const removeUrlRow = (idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const fetchOne = async (idx: number) => {
    const entry = entries[idx];
    if (!entry.url.trim()) {
      updateEntry(idx, { error: "Enter a GitHub URL first", status: "error" });
      return;
    }
    updateEntry(idx, { status: "fetching", error: undefined, result: undefined });

    try {
      const resp = await fetch("/api/github/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: entry.url.trim(),
          branch: entry.branch.trim() || null,
          githubToken: entry.token.trim() || null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json() as { error: string };
        updateEntry(idx, { status: "error", error: errData.error || "Failed to fetch" });
        return;
      }

      const result = await resp.json() as GithubFetchResult;
      updateEntry(idx, { status: "fetched", result });
    } catch (err) {
      updateEntry(idx, {
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  const fetchAll = async () => {
    await Promise.all(entries.map((_, i) => fetchOne(i)));
  };

  const saveAll = async () => {
    const fetched = entries.filter(e => e.status === "fetched" && e.result);
    if (fetched.length === 0) {
      toast({ title: "Nothing to save", description: "Fetch at least one repository first.", variant: "destructive" });
      return;
    }

    let savedCount = 0;
    for (const entry of fetched) {
      if (!entry.result) continue;
      await new Promise<void>((resolve) => {
        createMutation.mutate(
          {
            name: entry.result!.name,
            javaCode: entry.result!.javaCode,
            packageStructure: entry.result!.packageStructure,
          },
          {
            onSuccess: () => {
              savedCount++;
              const idx = entries.indexOf(entry);
              updateEntry(idx, { status: "saved" });
              resolve();
            },
            onError: () => resolve(),
          }
        );
      });
    }

    setJustSavedCount(savedCount);
    toast({
      title: `${savedCount} repo${savedCount !== 1 ? "s" : ""} added`,
      description: "Go to Run Analysis to start the pipeline.",
    });
  };

  const resetGithubForm = () => {
    setEntries([{ url: "", branch: "", token: "", showToken: false, status: "idle" }]);
    setAddMode("none");
    setJustSavedCount(0);
  };

  const onPasteSubmit = (data: PasteForm) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        toast({ title: "Repository added", description: `${data.name} is ready to analyze.` });
        pasteForm.reset();
        setAddMode("none");
        setJustSavedCount(s => s + 1);
      },
    });
  };

  const pendingFetch = entries.some(e => e.status === "fetching");
  const hasFetched = entries.some(e => e.status === "fetched");
  const hasSaved = entries.some(e => e.status === "saved");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Repositories</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import one or more backend repos (Python · Go · Java · Rust · TypeScript · Ruby · and more) to analyze together.
          </p>
        </div>
        {addMode === "none" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setAddMode("paste")}
              className="gap-2 border-white/10"
            >
              <Code className="w-4 h-4" /> Paste Code
            </Button>
            <Button onClick={() => setAddMode("github")} className="gap-2">
              <Github className="w-4 h-4" /> Import from GitHub
            </Button>
          </div>
        )}
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {justSavedCount > 0 && addMode === "none" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {justSavedCount} repositor{justSavedCount !== 1 ? "ies" : "y"} added successfully
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Go to Run Analysis to start the 6-step AI pipeline.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => { setJustSavedCount(0); onRepoAdded?.(); }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
            >
              Run Analysis <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GitHub multi-URL form ── */}
      <AnimatePresence>
        {addMode === "github" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="glass-panel border-primary/30 overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
                <div>
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Github className="w-4 h-4 text-primary" /> Import from GitHub
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add multiple URLs below — all will be fetched and saved together.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={resetGithubForm}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-3">
                {entries.map((entry, idx) => (
                  <div key={idx} className="rounded-xl border border-white/8 bg-black/20 overflow-hidden">
                    {/* Main row */}
                    <div className="flex gap-2 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="relative">
                          <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="https://github.com/owner/repo  or  …/tree/branchname"
                            value={entry.url}
                            onChange={e => updateEntry(idx, { url: e.target.value, status: "idle", error: undefined })}
                            className="bg-black/30 border-white/10 font-mono text-sm pl-9 w-full"
                            disabled={entry.status === "fetching" || entry.status === "saved"}
                          />
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {entry.status === "idle" && (
                          <Button size="sm" variant="ghost" className="h-9 px-3 bg-white/5 hover:bg-white/10" onClick={() => fetchOne(idx)}>
                            Fetch
                          </Button>
                        )}
                        {entry.status === "fetching" && (
                          <div className="flex items-center gap-2 text-xs text-primary px-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Fetching…
                          </div>
                        )}
                        {(entry.status === "fetched" || entry.status === "error") && entry.status !== "saved" && (
                          <Button size="sm" variant="ghost" className="h-9 px-3 bg-white/5 text-xs" onClick={() => fetchOne(idx)}>
                            Retry
                          </Button>
                        )}
                        {entry.status === "fetched" && entry.result && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1 px-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {entry.result.fileCount} files
                          </span>
                        )}
                        {entry.status === "saved" && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1 px-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                          </span>
                        )}
                        {entries.length > 1 && entry.status !== "saved" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeUrlRow(idx)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Error */}
                    {entry.status === "error" && entry.error && (
                      <div className="px-3 pb-2">
                        <p className="text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {entry.error}
                        </p>
                      </div>
                    )}

                    {/* Private token toggle */}
                    {entry.status !== "saved" && (
                      <div className="border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => updateEntry(idx, { showToken: !entry.showToken })}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-white/70 transition-colors"
                        >
                          <Lock className="w-3 h-3" />
                          Private repo? Add GitHub token
                          {entry.showToken
                            ? <ChevronUp className="w-3 h-3 ml-auto" />
                            : <ChevronDown className="w-3 h-3 ml-auto" />
                          }
                          {entry.token && !entry.showToken && (
                            <span className="ml-auto mr-1 text-[10px] text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> token set
                            </span>
                          )}
                        </button>
                        <AnimatePresence>
                          {entry.showToken && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-1.5">
                                <div className="relative">
                                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                  <Input
                                    type="password"
                                    placeholder="ghp_xxxxxxxxxxxx  or  fine-grained PAT"
                                    value={entry.token}
                                    onChange={e => updateEntry(idx, { token: e.target.value })}
                                    className="bg-black/40 border-white/10 font-mono text-sm pl-9"
                                    disabled={entry.status === "fetching"}
                                    autoComplete="off"
                                  />
                                </div>
                                <p className="text-[11px] text-muted-foreground pl-1">
                                  Needs <code className="text-white/50 bg-white/5 px-1 rounded">Contents: Read</code> scope.
                                  Token is used only for this fetch and never stored.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Fetched file tree preview */}
                    {entry.status === "fetched" && entry.result && (
                      <div className="border-t border-white/5 bg-black/30 px-4 py-3">
                        <p className="text-xs text-white/60 font-mono font-medium mb-2">{entry.result.name}</p>
                        <pre className="text-[11px] text-white/40 font-mono max-h-28 overflow-y-auto leading-relaxed">
                          {entry.result.packageStructure}
                        </pre>
                        {entry.result.truncated && (
                          <p className="text-yellow-400 text-[11px] mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Capped at 100 files — largest files prioritised
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add row + info */}
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={addUrlRow} className="gap-1.5 text-muted-foreground hover:text-white">
                    <Plus className="w-3.5 h-3.5" /> Add another repository
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Fetches <code className="text-primary">.py .ts .js</code> backend files · max 100 per repo
                  </p>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t border-white/5 bg-black/10 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={resetGithubForm} disabled={pendingFetch}>Cancel</Button>
                <div className="flex gap-3">
                  {!hasFetched && !hasSaved && (
                    <Button onClick={fetchAll} disabled={pendingFetch} className="gap-2">
                      {pendingFetch ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : <><Github className="w-4 h-4" /> Fetch All</>}
                    </Button>
                  )}
                  {hasFetched && (
                    <Button onClick={saveAll} disabled={createMutation.isPending || pendingFetch} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                      {createMutation.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                        : <><CheckCircle2 className="w-4 h-4" /> Add {entries.filter(e => e.status === "fetched").length} Repo{entries.filter(e => e.status === "fetched").length !== 1 ? "s" : ""} to Analysis</>}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Paste mode ── */}
      <AnimatePresence>
        {addMode === "paste" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="glass-panel border-primary/30 overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-primary" /> Paste Source Code
                </h4>
                <Button variant="ghost" size="icon" onClick={() => { setAddMode("none"); pasteForm.reset(); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6">
                <Form {...pasteForm}>
                  <form onSubmit={pasteForm.handleSubmit(onPasteSubmit)} className="space-y-4">
                    <FormField
                      control={pasteForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module / Service Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. payment-service" className="bg-black/30 border-white/10" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pasteForm.control}
                      name="javaCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Backend Source Code</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste backend source code here (Python, Go, Java, Rust, TypeScript, Ruby…)"
                              className="h-56 font-mono text-xs bg-black/50 border-white/10 resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pasteForm.control}
                      name="packageStructure"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>File Structure <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={"myapp/\n├── services/\n└── utils/"}
                              className="h-20 font-mono text-xs bg-black/50 border-white/10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3 pt-1">
                      <Button type="button" variant="ghost" onClick={() => { setAddMode("none"); pasteForm.reset(); }}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Saving…" : "Add to Analysis"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Repo list ── */}
      {!isLoading && (repos?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {repos?.map((repo) => (
            <Card key={repo.id} className="p-5 bg-black/20 border-white/5 hover:border-white/10 transition-colors flex flex-col group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {repo.name.includes("/") ? <Github className="w-5 h-5" /> : <FolderGit2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white font-mono text-sm">{repo.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Added {new Date(repo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">
                    {Math.round(repo.javaCode.length / 1024)} KB
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-all"
                    title="Remove repository"
                    onClick={() => {
                      if (confirm(`Remove "${repo.name}" from this analysis?`)) {
                        deleteMutation.mutate(repo.id, {
                          onSuccess: () => toast({ title: "Repository removed" }),
                        });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5 overflow-hidden">
                <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <Code className="w-3 h-3" /> Preview
                </div>
                <pre className="text-[10px] text-white/60 font-mono overflow-hidden leading-relaxed" style={{ maxHeight: "4.5rem" }}>
                  {repo.javaCode.slice(0, 350)}
                </pre>
              </div>
            </Card>
          ))}

          {/* Add more */}
          {addMode === "none" && (
            <button
              onClick={() => setAddMode("github")}
              className="p-5 border-2 border-dashed border-white/10 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all text-center group cursor-pointer min-h-[120px] flex flex-col items-center justify-center"
            >
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
              <p className="text-sm text-muted-foreground group-hover:text-white transition-colors">
                Add another repository
              </p>
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (repos?.length ?? 0) === 0 && addMode === "none" && (
        <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-2xl">
          <FileCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-white mb-1">No repositories yet</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Import from GitHub or paste your backend code to get started.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setAddMode("paste")} variant="outline" className="gap-2 border-white/10">
              <Code className="w-4 h-4" /> Paste Code
            </Button>
            <Button onClick={() => setAddMode("github")} className="gap-2">
              <Github className="w-4 h-4" /> Import from GitHub
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
