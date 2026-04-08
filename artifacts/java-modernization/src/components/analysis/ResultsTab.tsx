import { useResults } from "@/hooks/use-results";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, CheckCircle2, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

const STEP_COLORS: Record<number, string> = {
  1: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  2: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  3: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  4: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  5: "bg-pink-500/10 border-pink-500/20 text-pink-400",
  6: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
};

export function ResultsTab({ analysisId }: { analysisId: number }) {
  const { data: results, isLoading } = useResults(analysisId);

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    if (!results) return;
    const combined = results
      .sort((a, b) => a.step - b.step)
      .map(r => `# Step ${r.step}: ${r.stepName}\n\n${r.content}`)
      .join("\n\n---\n\n");
    downloadMarkdown(combined, `analysis-${analysisId}-full-report`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span>Loading results…</span>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-2xl max-w-lg mx-auto">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="text-lg font-semibold text-white mb-2">No Results Yet</h3>
        <p className="text-muted-foreground text-sm">
          Go to the <strong className="text-white">Run Analysis</strong> tab and run the pipeline to generate documentation.
        </p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => a.step - b.step);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Generated Documentation</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length} of 6 steps complete. Click any step to expand the output.
          </p>
        </div>
        <Button onClick={downloadAll} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
          <Download className="w-4 h-4" /> Download Full Report
        </Button>
      </div>

      {/* Step progress bar */}
      <div className="flex gap-1.5">
        {[1,2,3,4,5,6].map(n => {
          const done = sorted.some(r => r.step === n);
          return (
            <div
              key={n}
              className={`flex-1 h-1.5 rounded-full transition-colors ${done ? "bg-primary" : "bg-white/10"}`}
            />
          );
        })}
      </div>

      {/* Results accordion */}
      <Accordion
        type="multiple"
        defaultValue={sorted.map(r => r.id.toString())}
        className="space-y-3"
      >
        {sorted.map((result) => (
          <AccordionItem key={result.id} value={result.id.toString()} className="border-none">
            <Card className="glass-panel border-white/8 overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-white/[0.03] group [&>svg]:text-muted-foreground">
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${STEP_COLORS[result.step] ?? STEP_COLORS[6]}`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${STEP_COLORS[result.step] ?? STEP_COLORS[6]}`}>
                        Step {result.step}
                      </Badge>
                    </div>
                    <div className="font-semibold text-white mt-0.5 group-hover:text-primary transition-colors">
                      {result.stepName}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="border-t border-white/5 px-6 pb-6 pt-5">
                <div className="flex justify-end mb-5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white"
                    onClick={() => downloadMarkdown(
                      result.content,
                      `step-${result.step}-${result.stepName.toLowerCase().replace(/\s+/g, "-")}`
                    )}
                  >
                    <Download className="w-3.5 h-3.5" /> Save as Markdown
                  </Button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-gray-300
                  prose-headings:text-white prose-headings:font-semibold
                  prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base
                  prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
                  prose-table:w-full prose-th:text-left prose-th:text-white/70 prose-th:font-semibold
                  prose-strong:text-white prose-a:text-primary
                  prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground
                  prose-li:marker:text-muted-foreground/50">
                  <ReactMarkdown>{result.content}</ReactMarkdown>
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
