import { useAnalysisStream } from "@/hooks/use-analysis-stream";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, SquareTerminal, CheckCircle2, CircleDashed, Loader2, StopCircle } from "lucide-react";
import { useEffect, useRef } from "react";

const STEPS = [
  { id: 1, name: "Repository Discovery", desc: "Inventory all Python modules, classes, and functions." },
  { id: 2, name: "Business Logic Classification", desc: "Separate domain logic from infrastructure and data access." },
  { id: 3, name: "Business Rule Extraction", desc: "Extract detailed rules with inputs, outputs, and edge cases." },
  { id: 4, name: "Memory & State Mapping", desc: "Identify in-memory structures and shared state dependencies." },
  { id: 5, name: "Microservice Grouping", desc: "Propose logical service boundaries using domain-driven design." },
  { id: 6, name: "Requirements Document", desc: "Generate plain-English functional requirements per service." },
];

export function RunAnalysisTab({ analysisId, currentStep }: { analysisId: number, currentStep: number | null }) {
  const { isStreaming, content, currentStep: streamStep, stepName, error, startStream, stopStream } = useAnalysisStream(analysisId);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [content]);

  const activeStep = streamStep || currentStep || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h3 className="text-xl font-semibold text-white">Analysis Pipeline</h3>
          <p className="text-sm text-muted-foreground mt-1">Run individual phases or process the entire 6-step pipeline.</p>
        </div>
        <div className="flex gap-3">
          {isStreaming ? (
            <Button variant="destructive" onClick={stopStream} className="gap-2">
              <StopCircle className="w-4 h-4" /> Stop Analysis
            </Button>
          ) : (
            <Button onClick={() => startStream("full")} className="gap-2 glow-accent bg-accent hover:bg-accent/90">
              <Play className="w-4 h-4" /> Run Full Analysis
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 shrink-0">
        {STEPS.map((step) => {
          const isPast = activeStep > step.id;
          const isCurrent = activeStep === step.id && isStreaming;
          
          return (
            <Card 
              key={step.id} 
              className={`p-4 transition-all duration-300 ${
                isCurrent ? "border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : 
                isPast ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-black/20"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {isCurrent ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : isPast ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <CircleDashed className="w-5 h-5 text-muted-foreground/50" />
                  )}
                  <span className={`font-semibold text-sm ${isCurrent ? "text-primary" : isPast ? "text-white" : "text-muted-foreground"}`}>
                    Step {step.id}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs bg-white/5 hover:bg-white/10"
                  disabled={isStreaming}
                  onClick={() => startStream("step", step.id)}
                >
                  Run
                </Button>
              </div>
              <p className={`text-sm font-medium ${isCurrent ? "text-white" : "text-white/70"}`}>{step.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
            </Card>
          );
        })}
      </div>

      <div className="flex-1 bg-black/40 rounded-xl border border-white/5 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
          <SquareTerminal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {isStreaming
              ? `Running: ${stepName || "Initializing..."}`
              : error
              ? "Error occurred"
              : "Analysis Output"}
          </span>
          {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-1" />}
        </div>
        <div
          ref={consoleRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs text-white/80 leading-relaxed whitespace-pre-wrap"
        >
          {error && (
            <div className="text-red-400 mb-4">Error: {error}</div>
          )}
          {content || (
            <span className="text-muted-foreground/50">
              Select a step above or click "Run Full Analysis" to begin...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
