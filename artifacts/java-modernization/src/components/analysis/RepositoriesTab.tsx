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
  AlertCircle, CheckCircle2, Loader2, FolderGit2, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const pasteSchema = z.object({
  name: z.string().min(1, "Repository name is required"),
  javaCode: z.string().min(10, "Source code is required"),
  packageStructure: z.string().optional(),
});

const githubSchema = z.object({
  repoUrl: z.string().url("Must be a valid URL").includes("github.com", { message: "Must be a GitHub URL" }),
  branch: z.string().optional(),
  githubToken: z.string().optional(),
});

type PasteForm = z.infer<typeof pasteSchema>;
type GithubForm = z.infer<typeof githubSchema>;

interface GithubFetchResult {
  name: string;
  javaCode: string;
  packageStructure: string;
  fileCount: number;
  truncated: boolean;
}

interface Props {
  analysisId: number;
  onRepoAdded?: () => void;
}

export function RepositoriesTab({ analysisId, onRepoAdded }: Props) {
  const { data: repos, isLoading } = useRepositories(analysisId);
  const createMutation = useCreateRepository(analysisId);
  const deleteMutation = useDeleteRepository(analysisId);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<"paste" | "github">("github");
  const [githubStatus, setGithubStatus] = useState<"idle" | "fetching" | "fetched" | "error">("idle");
  const [githubResult, setGithubResult] = useState<GithubFetchResult | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const pasteForm = useForm<PasteForm>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { name: "", javaCode: "", packageStructure: "" },
  });

  const githubForm = useForm<GithubForm>({
    resolver: zodResolver(githubSchema),
    defaultValues: { repoUrl: "", branch: "", githubToken: "" },
  });

  const handleSaveSuccess = (name: string) => {
    setJustAdded(name);
    setIsAdding(false);
    setGithubResult(null);
    setGithubStatus("idle");
    setGithubError(null);
    pasteForm.reset();
    githubForm.reset();
  };

  const onPasteSubmit = (data: PasteForm) => {
    createMutation.mutate(data, {
      onSuccess: () => handleSaveSuccess(data.name),
    });
  };

  const onGithubFetch = async (data: GithubForm) => {
    setGithubStatus("fetching");
    setGithubError(null);
    setGithubResult(null);

    try {
      const resp = await fetch("/api/github/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: data.repoUrl,
          branch: data.branch || null,
          githubToken: data.githubToken || null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json() as { error: string };
        setGithubStatus("error");
        setGithubError(errData.error || "Failed to fetch repository");
        return;
      }

      const result = await resp.json() as GithubFetchResult;
      setGithubResult(result);
      setGithubStatus("fetched");
    } catch (err) {
      setGithubStatus("error");
      setGithubError(err instanceof Error ? err.message : "Network error");
    }
  };

  const onGithubSave = () => {
    if (!githubResult) return;
    createMutation.mutate(
      {
        name: githubResult.name,
        javaCode: githubResult.javaCode,
        packageStructure: githubResult.packageStructure,
      },
      {
        onSuccess: () => handleSaveSuccess(githubResult.name),
      }
    );
  };

  const resetForm = () => {
    setIsAdding(false);
    setGithubStatus("idle");
    setGithubResult(null);
    setGithubError(null);
    pasteForm.reset();
    githubForm.reset();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Repositories</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import backend source code to analyze. Supports Python, TypeScript, and JavaScript.
          </p>
        </div>
        {!isAdding && (
          <Button onClick={() => { setIsAdding(true); setJustAdded(null); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Repository
          </Button>
        )}
      </div>

      {/* Success banner after adding */}
      <AnimatePresence>
        {justAdded && !isAdding && (
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
                  <span className="font-mono text-emerald-400">{justAdded}</span> added successfully
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ready to analyze. Go to the Run Analysis tab to start.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onRepoAdded?.()}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
            >
              Run Analysis <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="glass-panel border-primary/30 overflow-hidden">
              {/* Mode tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setAddMode("github")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                    addMode === "github"
                      ? "text-white border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Github className="w-4 h-4" /> Import from GitHub
                </button>
                <button
                  onClick={() => setAddMode("paste")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                    addMode === "paste"
                      ? "text-white border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Code className="w-4 h-4" /> Paste Code
                </button>
              </div>

              <div className="p-6">
                {/* ── GitHub Import ── */}
                {addMode === "github" && (
                  <div className="space-y-5">
                    {githubStatus !== "fetched" && (
                      <Form {...githubForm}>
                        <form onSubmit={githubForm.handleSubmit(onGithubFetch)} className="space-y-4">
                          <FormField
                            control={githubForm.control}
                            name="repoUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GitHub Repository URL</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://github.com/owner/repo"
                                    className="bg-black/30 border-white/10 font-mono"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={githubForm.control}
                              name="branch"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Branch <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                                  <FormControl>
                                    <Input placeholder="main" className="bg-black/30 border-white/10" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={githubForm.control}
                              name="githubToken"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Token <span className="text-muted-foreground font-normal">(private repos)</span></FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="ghp_xxxx" className="bg-black/30 border-white/10 font-mono" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <p className="text-xs text-muted-foreground bg-black/20 rounded-lg p-3 border border-white/5">
                            Fetches <code className="text-primary">.py</code>, <code className="text-primary">.ts</code>, and <code className="text-primary">.js</code> backend files (up to 100). UI, tests, and config files are excluded automatically.
                          </p>

                          {githubStatus === "error" && githubError && (
                            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                              <span>{githubError}</span>
                            </div>
                          )}

                          <div className="flex justify-end gap-3 pt-1">
                            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                            <Button type="submit" disabled={githubStatus === "fetching"} className="gap-2">
                              {githubStatus === "fetching"
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
                                : <><Github className="w-4 h-4" /> Fetch Repository</>}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )}

                    {/* Fetched preview */}
                    {githubStatus === "fetched" && githubResult && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-white">
                              <span className="font-mono text-primary">{githubResult.name}</span> fetched successfully
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {githubResult.fileCount} backend file{githubResult.fileCount !== 1 ? "s" : ""} · {Math.round(githubResult.javaCode.length / 1024)} KB of source code
                              {githubResult.truncated && <span className="text-yellow-400 ml-2">⚠ Capped at 100 files</span>}
                            </p>
                          </div>
                        </div>

                        <div className="bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-black/20">
                            <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">File Tree</span>
                          </div>
                          <pre className="text-[11px] text-white/70 font-mono p-4 max-h-52 overflow-y-auto leading-relaxed">
                            {githubResult.packageStructure}
                          </pre>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <Button variant="ghost" size="sm" onClick={() => { setGithubStatus("idle"); setGithubResult(null); }}>
                            ← Change URL
                          </Button>
                          <div className="flex gap-3">
                            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
                            <Button onClick={onGithubSave} disabled={createMutation.isPending} className="gap-2 bg-primary hover:bg-primary/90">
                              {createMutation.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                : <><CheckCircle2 className="w-4 h-4" /> Add to Analysis</>}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ── Paste Mode ── */}
                {addMode === "paste" && (
                  <Form {...pasteForm}>
                    <form onSubmit={pasteForm.handleSubmit(onPasteSubmit)} className="space-y-4">
                      <FormField
                        control={pasteForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Repository / Module Name</FormLabel>
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
                                placeholder="Paste Python, TypeScript, or JavaScript backend code here..."
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
                                placeholder={"myapp/\n├── services/\n├── models/\n└── utils/"}
                                className="h-24 font-mono text-xs bg-black/50 border-white/10"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                        <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                          {createMutation.isPending ? "Saving..." : "Add to Analysis"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Repo cards */}
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
                    <p className="text-xs text-muted-foreground mt-0.5">Added {new Date(repo.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">
                    {Math.round(repo.javaCode.length / 1024)} KB
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/20 transition-all"
                    onClick={() => {
                      if (confirm("Remove this repository from the analysis?")) {
                        deleteMutation.mutate(repo.id);
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
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (repos?.length ?? 0) === 0 && !isAdding && (
        <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-2xl">
          <FileCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-white mb-1">No repositories yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Import a GitHub repo or paste your backend code to get started.</p>
          <Button onClick={() => setIsAdding(true)} variant="outline" className="gap-2 border-white/10">
            <Plus className="w-4 h-4" /> Add First Repository
          </Button>
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
