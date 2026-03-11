import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAnalysisQueryKey, getListResultsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface StreamState {
  isStreaming: boolean;
  content: string;
  currentStep: number | null;
  stepName: string | null;
  error: string | null;
}

export function useAnalysisStream(analysisId: number) {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    content: "",
    currentStep: null,
    stepName: null,
    error: null,
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (type: "full" | "step", stepNum?: number) => {
    setState({ isStreaming: true, content: "", currentStep: stepNum || null, stepName: null, error: null });
    
    abortControllerRef.current = new AbortController();
    const url = type === "full" 
      ? `/api/analyze/${analysisId}/full` 
      : `/api/analyze/${analysisId}/step/${stepNum}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to start analysis: ${response.statusText}`);
      }

      if (!response.body) throw new Error("No readable stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.content) {
                  accumulatedText += data.content;
                  setState(s => ({ ...s, content: accumulatedText }));
                }
                
                if (data.step) {
                  setState(s => ({ ...s, currentStep: data.step, stepName: data.stepName || s.stepName }));
                }

                if (data.done) {
                  // If it's a multi-step full run, we might get multiple 'done' events per step
                  // We invalidate cache to fetch the newly generated result in the DB
                  queryClient.invalidateQueries({ queryKey: getListResultsQueryKey(analysisId) });
                  queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
                }
                
              } catch (e) {
                console.error("Failed to parse SSE data chunk", e);
              }
            }
          }
        }
      }
      
      setState(s => ({ ...s, isStreaming: false }));
      toast({ title: "Analysis Complete", description: "The analysis phase has finished successfully." });
      
    } catch (err: any) {
      if (err.name === "AbortError") {
        setState(s => ({ ...s, isStreaming: false, error: "Analysis cancelled" }));
      } else {
        setState(s => ({ ...s, isStreaming: false, error: err.message || "An error occurred" }));
        toast({ title: "Analysis Error", description: err.message, variant: "destructive" });
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey(analysisId) });
    }
  }, [analysisId, queryClient, toast]);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { ...state, startStream, stopStream };
}
