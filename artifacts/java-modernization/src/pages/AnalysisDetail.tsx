import { AppLayout } from "@/components/layout/AppLayout";
import { useAnalysis } from "@/hooks/use-analyses";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, PlayCircle, FileCheck, Loader2 } from "lucide-react";
import { RepositoriesTab } from "@/components/analysis/RepositoriesTab";
import { RunAnalysisTab } from "@/components/analysis/RunAnalysisTab";
import { ResultsTab } from "@/components/analysis/ResultsTab";

export default function AnalysisDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data: analysis, isLoading, error } = useAnalysis(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !analysis) {
    return (
      <AppLayout>
        <div className="p-8 text-destructive">Failed to load analysis session.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-8 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
              {analysis.status.replace("_", " ")}
            </div>
            <span className="text-sm text-muted-foreground font-mono">ID: {analysis.id}</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">{analysis.name}</h1>
          {analysis.description && (
            <p className="mt-2 text-muted-foreground text-lg">{analysis.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-auto">
          <Tabs defaultValue="repos" className="w-full">
            <TabsList className="bg-black/40 border border-white/5 p-1 rounded-xl mb-8">
              <TabsTrigger value="repos" className="gap-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">
                <Database className="w-4 h-4" /> Repositories
              </TabsTrigger>
              <TabsTrigger value="run" className="gap-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <PlayCircle className="w-4 h-4" /> Run Analysis
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white">
                <FileCheck className="w-4 h-4" /> Results
              </TabsTrigger>
            </TabsList>

            <div className="max-w-6xl">
              <TabsContent value="repos" className="mt-0 outline-none">
                <RepositoriesTab analysisId={analysis.id} />
              </TabsContent>
              <TabsContent value="run" className="mt-0 outline-none">
                <RunAnalysisTab analysisId={analysis.id} currentStep={analysis.currentStep} />
              </TabsContent>
              <TabsContent value="results" className="mt-0 outline-none">
                <ResultsTab analysisId={analysis.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
