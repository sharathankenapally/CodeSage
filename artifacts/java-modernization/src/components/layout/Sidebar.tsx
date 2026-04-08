import { Link, useLocation } from "wouter";
import { Plus, FolderGit2, Trash2, Cpu, Loader2 } from "lucide-react";
import { useAnalyses, useDeleteAnalysis } from "@/hooks/use-analyses";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";
import CreateAnalysisDialog from "../CreateAnalysisDialog";

export function Sidebar() {
  const [location] = useLocation();
  const { data: analyses, isLoading } = useAnalyses();
  const deleteMutation = useDeleteAnalysis();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="w-72 bg-card border-r border-border h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          PyAnalyzer
        </h1>
      </div>

      <div className="p-4 border-b border-white/5">
        <Button 
          onClick={() => setCreateOpen(true)}
          className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10"
          variant="outline"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Sessions
        </div>
        
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : analyses?.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No analysis sessions yet.
          </div>
        ) : (
          analyses?.map((analysis) => {
            const isActive = location === `/analysis/${analysis.id}`;
            return (
              <div 
                key={analysis.id}
                className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <Link href={`/analysis/${analysis.id}`} className="flex-1 flex items-center gap-3 overflow-hidden">
                  <FolderGit2 className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{analysis.name}</p>
                    <p className="text-[10px] opacity-60 truncate">
                      {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </Link>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    if(confirm("Delete this analysis session?")) deleteMutation.mutate(analysis.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/20 hover:text-destructive rounded-md transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <CreateAnalysisDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
