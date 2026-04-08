import { useAnalysisStream } from "@/hooks/use-analysis-stream";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Play, SquareTerminal, CheckCircle2, CircleDashed,
  Loader2, StopCircle, AlertCircle, ArrowRight, ChevronRight
} from "lucide-react";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { id: 1, name: "Repository Discovery",         desc: "Inventory all modules, classes, and functions." },
  { id: 2, name: "Business Logic Classification", desc: "Classify each function as Business Rule or Orchestration." },
  { id: 3, name: "Business Rule Extraction",      desc: "Document inputs, outputs, and edge cases per rule." },
  { id: 4, name: "Memory & State Mapping",        desc: "Identify in-memory structures and shared state." },
  { id: 5, name: "Microservice Grouping",         desc: "Propose service boundaries using domain-driven design." },
  { id: 6, name: "Requirements Document",         desc: "Generate plain-English requirements per service." },
];

interface Props {
  analysisId: number;
  currentStep: number | null;
  repoCount: number;
  onViewResults?: () => void;
}

export function RunAnalysisTab({ analysisId, currentStep, repoCount, onViewResults }: Props) {
  const {
    isStreaming, content, currentStep: streamStep,
    stepName, error, startStream, stopStream
  } = useAnalysisStream(analysisId);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [content]);

  const activeStep = streamStep || currentStep || 0;
  const isDone = !isStreaming && !error && content.length > 0 && activeStep >= 6;

  // Guard: no repos
  if (repoCount === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-2xl max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-yellow-400/50 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No repositories added</h3>
        <p className="text-muted-foreground text-sm">
          Go to the <strong className="text-white">Repositories</strong> tab and add at least one repository before running the analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header + actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">Analysis Pipeline</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Run all 6 steps in sequence, or run any individual step.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          {isStreaming ? (
            <Button variant="destructive" onClick={stopStream} className="gap-2">
              <StopCircle className="w-4 h-4" /> Stop
            </Button>
          ) : (
            <>
              {isDone && (
                <Button variant="outline" onClick={onViewResults} className="gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
                  View Results <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              <Button onClick={() => startStream("full")} className="gap-2 bg-primary hover:bg-primary/90 text-white">
                <Play className="w-4 h-4" /> Run Full Analysis
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Step grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {STEPS.map((step) => {
          const isPast    = activeStep > step.id;
          const isCurrent = activeStep === step.id && isStreaming;

          return (
            <Card
              key={step.id}
              className={`p-4 transition-all duration-300 ${
                isCurrent
                  ? "border-primary/60 bg-primary/5 shadow-[0_0_20px_rgba(59,130,246,0.12)]"
                  : isPast
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-white/5 bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isCurrent ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : isPast ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <CircleDashed className="w-4 h-4 text-muted-foreground/40" />
                  )}
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isCurrent ? "text-primary" : isPast ? "text-emerald-400" : "text-muted-foreground/50"
                  }`}>
                    Step {step.id}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2 bg-white/5 hover:bg-white/10"
                  disabled={isStreaming}
                  onClick={() => startStream("step", step.id)}
                >
                  Run
                </Button>
              </div>
              <p className={`text-sm font-semibold leading-tight ${
                isCurrent ? "text-white" : isPast ? "text-white/80" : "text-white/50"
              }`}>{step.name}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
            </Card>
          );
        })}
      </div>

      {/* Live output console */}
      <div className="rounded-xl border border-white/5 bg-black/40 flex flex-col overflow-hidden" style={{ minHeight: "320px" }}>
        {/* Console bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/30 shrink-0">
          <div className="flex items-center gap-2">
            <SquareTerminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">
              {isStreaming
                ? <span className="text-primary">{stepName ? `Running: ${stepName}` : "Starting…"}</span>
                : error
                ? <span className="text-destructive">Error</span>
                : isDone
                ? <span className="text-emerald-400">Analysis complete</span>
                : "Output will appear here"}
            </span>
            {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          </div>
          {isDone && (
            <Button size="sm" variant="ghost" onClick={onViewResults} className="gap-1.5 text-emerald-400 hover:text-emerald-300 h-7 text-xs">
              View Results <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Output area */}
        <div
          ref={consoleRef}
          className="flex-1 overflow-y-auto p-5 font-mono text-xs leading-relaxed text-white/80 whitespace-pre-wrap"
        >
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 text-destructive mb-4"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {content || (
            <span className="text-muted-foreground/40 italic">
              Click "Run Full Analysis" to begin the 6-step AI analysis pipeline…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
