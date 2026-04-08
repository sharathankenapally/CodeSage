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
import { FileCode, Trash2, Plus, Code, Github, AlertCircle, CheckCircle2, Loader2, FolderGit2 } from "lucide-react";
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

export function RepositoriesTab({ analysisId }: { analysisId: number }) {
  const { data: repos, isLoading } = useRepositories(analysisId);
  const createMutation = useCreateRepository(analysisId);
  const deleteMutation = useDeleteRepository(analysisId);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<"paste" | "github">("github");
  const [githubStatus, setGithubStatus] = useState<"idle" | "fetching" | "fetched" | "error">("idle");
  const [githubResult, setGithubResult] = useState<GithubFetchResult | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  const pasteForm = useForm<PasteForm>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { name: "", javaCode: "", packageStructure: "" },
  });

  const githubForm = useForm<GithubForm>({
    resolver: zodResolver(githubSchema),
    defaultValues: { repoUrl: "", branch: "", githubToken: "" },
  });

  const onPasteSubmit = (data: PasteForm) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        pasteForm.reset();
        setIsAdding(false);
      },
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
        onSuccess: () => {
          githubForm.reset();
          setGithubResult(null);
          setGithubStatus("idle");
          setIsAdding(false);
        },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Repositories</h3>
          <p className="text-sm text-muted-foreground mt-1">Import from GitHub or paste backend source code directly. Supports Python, TypeScript, and JavaScript.</p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="gap-2 glow-primary" data-testid="button-add-repository">
            <Plus className="w-4 h-4" /> Add Repository
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="glass-panel border-primary/30 overflow-hidden">
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setAddMode("github")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                    addMode === "github"
                      ? "text-white border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Github className="w-4 h-4" />
                  Import from GitHub
                </button>
                <button
                  onClick={() => setAddMode("paste")}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                    addMode === "paste"
                      ? "text-white border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Paste Code
                </button>
              </div>

              <div className="p-6">
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
                                    placeholder="https://github.com/owner/python-repo"
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
                                    <Input
                                      placeholder="main"
                                      className="bg-black/30 border-white/10"
                                      {...field}
                                    />
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
                                  <FormLabel>GitHub Token <span className="text-muted-foreground font-normal">(private repos)</span></FormLabel>
                                  <FormControl>
                                    <Input
                                      type="password"
                                      placeholder="ghp_xxxxxxxxxxxx"
                                      className="bg-black/30 border-white/10 font-mono"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="bg-black/20 rounded-lg p-3 border border-white/5 text-xs text-muted-foreground">
                            Backend files (<code className="text-primary">.py</code>, <code className="text-primary">.ts</code>, <code className="text-primary">.js</code>) will be fetched — up to 100 files. UI components, tests, config files, and build artifacts are automatically excluded.
                          </div>

                          {githubStatus === "error" && githubError && (
                            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                              <span>{githubError}</span>
                            </div>
                          )}

                          <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                            <Button
                              type="submit"
                              disabled={githubStatus === "fetching"}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                            >
                              {githubStatus === "fetching" ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Fetching files...</>
                              ) : (
                                <><Github className="w-4 h-4" /> Fetch Repository</>
                              )}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )}

                    {githubStatus === "fetched" && githubResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-white">
                              Fetched <span className="text-primary font-mono">{githubResult.name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {githubResult.fileCount} Python file{githubResult.fileCount !== 1 ? "s" : ""} · {Math.round(githubResult.javaCode.length / 1024)} KB of source code
                              {githubResult.truncated && <span className="text-yellow-400 ml-2">⚠ Results truncated at 100 files</span>}
                            </p>
                          </div>
                        </div>

                        <div className="bg-black/40 rounded-lg border border-white/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-black/20">
                            <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">File Tree</span>
                          </div>
                          <pre className="text-[11px] text-white/70 font-mono p-4 max-h-48 overflow-y-auto">
                            {githubResult.packageStructure}
                          </pre>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <Button
                            variant="ghost"
                            onClick={() => { setGithubStatus("idle"); setGithubResult(null); }}
                            className="text-muted-foreground"
                          >
                            ← Change URL
                          </Button>
                          <div className="flex gap-3">
                            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                            <Button
                              onClick={onGithubSave}
                              disabled={createMutation.isPending}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                            >
                              {createMutation.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                              ) : (
                                <><CheckCircle2 className="w-4 h-4" /> Add to Analysis</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

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
                              <Input
                                placeholder="e.g. payment-service"
                                className="bg-black/30 border-white/10"
                                {...field}
                              />
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
                                placeholder="# Python, TypeScript, or JavaScript backend code..."
                                className="h-64 font-mono text-xs bg-black/50 border-white/10 resize-y"
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
                            <FormLabel>File / Package Structure <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={"myapp/\n├── services/\n├── models/\n└── utils/"}
                                className="h-28 font-mono text-xs bg-black/50 border-white/10"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {createMutation.isPending ? "Saving..." : "Save Repository"}
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {repos?.map((repo) => (
          <Card
            key={repo.id}
            className="p-5 bg-black/20 border-white/5 hover:border-white/10 transition-colors flex flex-col group"
          >
            <div className="flex justify-between items-start mb-4">
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
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/20 hover:text-destructive transition-all"
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
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <Code className="w-3.5 h-3.5" /> Preview
              </div>
              <pre className="text-[10px] text-white/60 font-mono overflow-hidden" style={{ maxHeight: "5rem" }}>
                {repo.javaCode.slice(0, 400)}
              </pre>
            </div>
          </Card>
        ))}

        {!isLoading && repos?.length === 0 && !isAdding && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-white/10 rounded-xl">
            <FileCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-1">No repositories added yet</h3>
            <p className="text-muted-foreground text-sm">Import from GitHub or paste Python source code to begin.</p>
            <Button
              onClick={() => setIsAdding(true)}
              variant="outline"
              className="mt-6 border-white/10 gap-2"
            >
              <Plus className="w-4 h-4" /> Add Repository
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
