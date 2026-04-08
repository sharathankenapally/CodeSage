import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAnalysis } from "@/hooks/use-analyses";
import { useRepositories } from "@/hooks/use-repositories";
import { useResults } from "@/hooks/use-results";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, PlayCircle, FileCheck, Loader2, AlertCircle } from "lucide-react";
import { RepositoriesTab } from "@/components/analysis/RepositoriesTab";
import { RunAnalysisTab } from "@/components/analysis/RunAnalysisTab";
import { ResultsTab } from "@/components/analysis/ResultsTab";
import { Badge } from "@/components/ui/badge";

const STATUS_COLOR: Record<string, string> = {
  pending:     "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed:      "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AnalysisDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [activeTab, setActiveTab] = useState("repos");

  const { data: analysis, isLoading, error } = useAnalysis(id);
  const { data: repos } = useRepositories(id);
  const { data: results } = useResults(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading session...</span>
        </div>
      </AppLayout>
    );
  }

  if (error || !analysis) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-white font-medium">Session not found</p>
            <p className="text-muted-foreground text-sm">This analysis session may have been deleted.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const repoCount = repos?.length ?? 0;
  const resultCount = results?.length ?? 0;
  const statusKey = analysis.status as string;

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-8 py-6 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${STATUS_COLOR[statusKey] ?? STATUS_COLOR.pending}`}>
              {analysis.status.replace("_", " ")}
            </span>
            <span className="text-xs text-muted-foreground font-mono">Session #{analysis.id}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{analysis.name}</h1>
          {analysis.description && (
            <p className="mt-1.5 text-muted-foreground">{analysis.description}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="shrink-0 px-8 pt-6 pb-0">
              <TabsList className="bg-black/40 border border-white/5 p-1 rounded-xl">
                <TabsTrigger
                  value="repos"
                  className="gap-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  <Database className="w-4 h-4" />
                  Repositories
                  {repoCount > 0 && (
                    <Badge className="ml-1 bg-primary/20 text-primary border-primary/30 text-[10px] h-4 px-1.5">
                      {repoCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="run"
                  className="gap-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  <PlayCircle className="w-4 h-4" />
                  Run Analysis
                  {analysis.status === "in_progress" && (
                    <Loader2 className="w-3 h-3 animate-spin ml-1" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="results"
                  className="gap-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  <FileCheck className="w-4 h-4" />
                  Results
                  {resultCount > 0 && (
                    <Badge className="ml-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-4 px-1.5">
                      {resultCount}/6
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 px-8 py-6 overflow-auto">
              <TabsContent value="repos" className="mt-0 outline-none h-full">
                <RepositoriesTab
                  analysisId={analysis.id}
                  onRepoAdded={() => setActiveTab("run")}
                />
              </TabsContent>
              <TabsContent value="run" className="mt-0 outline-none h-full">
                <RunAnalysisTab
                  analysisId={analysis.id}
                  currentStep={analysis.currentStep}
                  repoCount={repoCount}
                  onViewResults={() => setActiveTab("results")}
                />
              </TabsContent>
              <TabsContent value="results" className="mt-0 outline-none h-full">
                <ResultsTab analysisId={analysis.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
