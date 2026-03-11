import { useAnalysisStream } from "@/hooks/use-analysis-stream";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, SquareTerminal, CheckCircle2, CircleDashed, Loader2, StopCircle } from "lucide-react";
import { useEffect, useRef } from "react";

const STEPS = [
  { id: 1, name: "Repository Discovery", desc: "Inventory packages, classes, and annotations." },
  { id: 2, name: "Business Logic Classification", desc: "Separate domain logic from infrastructure." },
  { id: 3, name: "Business Rule Extraction", desc: "Extract detailed logic per class." },
  { id: 4, name: "Memory Store Mapping", desc: "Identify data structures and DB migrations." },
  { id: 5, name: "Microservice Grouping", desc: "Propose new service boundaries." },
  { id: 6, name: "Requirements Generation", desc: "Draft plain-English tech specs." },
];

export function RunAnalysisTab({ analysisId, currentStep }: { analysisId: number, currentStep: number | null }) {
  const { isStreaming, content, currentStep: streamStep, stepName, error, startStream, stopStream } = useAnalysisStream(analysisId);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [content]);

  // Determine actual active step
  const activeStep = streamStep || currentStep || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h3 className="text-xl font-semibold text-white">Execution Engine</h3>
          <p className="text-sm text-muted-foreground mt-1">Run individual phases or process the entire pipeline.</p>
        </div>
        <div className="flex gap-3">
          {isStreaming ? (
            <Button variant="destructive" onClick={stopStream} className="gap-2">
              <StopCircle className="w-4 h-4" /> Stop Execution
            </Button>
          ) : (
            <Button onClick={() => startStream("full")} className="gap-2 glow-accent bg-accent hover:bg-accent/90">
              <Play className="w-4 h-4" /> Run Full Pipeline
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
              <h4 className="text-white font-medium text-sm mb-1">{step.name}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
            </Card>
          );
        })}
      </div>

      <Card className="flex-1 flex flex-col bg-[#0A0A0A] border-white/10 overflow-hidden relative shadow-2xl">
        <div className="h-10 border-b border-white/10 bg-white/5 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <SquareTerminal className="w-4 h-4" />
            <span>sys.stdout</span>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-primary font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              PROCESSING {stepName ? `[${stepName}]` : ""}
            </div>
          )}
        </div>
        <div 
          ref={consoleRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-sm leading-relaxed text-gray-300"
        >
          {content ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <div className="text-muted-foreground/30 italic">Waiting for execution to start...</div>
          )}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse ml-1 align-middle" />
          )}
          {error && (
            <div className="text-destructive mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
              ERROR: {error}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
