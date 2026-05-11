import { AppLayout } from "@/components/layout/AppLayout";
import { useAnalyses } from "@/hooks/use-analyses";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Code2, ArrowRight, FolderGit2, Plus, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import CreateAnalysisDialog from "@/components/CreateAnalysisDialog";
import { format } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  pending:     "bg-yellow-500/20 text-yellow-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed:   "bg-emerald-500/20 text-emerald-400",
  failed:      "bg-red-500/20 text-red-400",
};

export default function Home() {
  const { data: analyses, isLoading } = useAnalyses();
  const [createOpen, setCreateOpen] = useState(false);
  const hasSessions = (analyses?.length ?? 0) > 0;

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-8 py-8 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">PyAnalyzer</h1>
              <p className="text-muted-foreground mt-1">
                AI-powered business rules &amp; requirements extractor for any backend codebase
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> New Analysis
            </Button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-32 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Loading sessions…</span>
            </div>
          ) : hasSessions ? (
            <div className="space-y-4 max-w-4xl">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Your Analysis Sessions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analyses!.map((analysis) => (
                  <Link key={analysis.id} href={`/analysis/${analysis.id}`}>
                    <Card className="p-5 glass-panel border-white/5 hover:border-primary/30 cursor-pointer transition-all duration-200 group hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary/20 transition-colors">
                          <FolderGit2 className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_COLOR[analysis.status] ?? STATUS_COLOR.pending}`}>
                          {analysis.status.replace("_", " ")}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white group-hover:text-primary transition-colors">{analysis.name}</h3>
                      {analysis.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{analysis.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Open <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}

                {/* Create new card */}
                <button
                  onClick={() => setCreateOpen(true)}
                  className="p-5 border-2 border-dashed border-white/10 rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 text-center group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
                    <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-white transition-colors">
                    New Analysis Session
                  </p>
                </button>
              </div>
            </div>
          ) : (
            /* Welcome / empty state */
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center mx-auto shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 opacity-50" />
                  <Code2 className="w-10 h-10 text-white relative z-10" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white">Welcome to PyAnalyzer</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Analyze any backend repository — Python, Go, Java, Rust, TypeScript, Ruby, and more — with AI to extract business rules and generate structured requirements.
                </p>
                <div className="pt-2">
                  <Button size="lg" onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="w-5 h-5" /> Create First Analysis
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground/50">
                  Import from GitHub or paste your code directly
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateAnalysisDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}
