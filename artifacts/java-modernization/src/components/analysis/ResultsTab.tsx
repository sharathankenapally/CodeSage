import { useResults } from "@/hooks/use-results";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ResultsTab({ analysisId }: { analysisId: number }) {
  const { data: results, isLoading } = useResults(analysisId);

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
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
    return <div className="text-center py-12 text-muted-foreground animate-pulse">Loading results...</div>;
  }

  if (!results || results.length === 0) {
    return (
      <div className="py-20 text-center border border-white/5 rounded-xl bg-black/20">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-medium text-white mb-2">No Results Yet</h3>
        <p className="text-muted-foreground">Run the analysis steps to generate documentation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Generated Documentation</h3>
          <p className="text-sm text-muted-foreground mt-1">Review the AI outputs for each phase of the modernization.</p>
        </div>
        <Button onClick={downloadAll} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
          <Download className="w-4 h-4" /> Download Complete Report
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[results[0]?.id.toString()]} className="space-y-4">
        {results.sort((a, b) => a.step - b.step).map((result) => (
          <AccordionItem key={result.id} value={result.id.toString()} className="border-none">
            <Card className="glass-panel border-white/10 overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-white/5 group">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground font-mono mb-0.5">STEP {result.step}</div>
                    <div className="font-semibold text-white text-lg group-hover:text-primary transition-colors">
                      {result.stepName}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2 border-t border-white/5">
                <div className="flex justify-end mb-4">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 gap-2 bg-white/5"
                    onClick={() => downloadMarkdown(result.content, `step-${result.step}-${result.stepName.toLowerCase().replace(/\s+/g, '-')}`)}
                  >
                    <Download className="w-3.5 h-3.5" /> Save Step
                  </Button>
                </div>
                <div className="prose prose-invert max-w-none text-gray-300">
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
