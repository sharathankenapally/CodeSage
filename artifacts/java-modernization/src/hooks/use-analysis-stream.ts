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

/** Parse SSE text. Returns complete events found so far and any leftover partial line. */
function parseSSEChunk(buffer: string): { events: Record<string, unknown>[]; remaining: string } {
  const events: Record<string, unknown>[] = [];
  const blocks = buffer.split("\n\n");
  // The last element might be a partial block — keep it as remaining
  const remaining = blocks.pop() ?? "";

  for (const block of blocks) {
    const lines = block.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const json = line.slice(6).trim();
        if (!json || json === "[DONE]") continue;
        try {
          events.push(JSON.parse(json) as Record<string, unknown>);
        } catch {
          // skip malformed event
        }
      }
    }
  }

  return { events, remaining };
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
    setState({ isStreaming: true, content: "", currentStep: stepNum ?? null, stepName: null, error: null });

    abortControllerRef.current = new AbortController();
    const url = type === "full"
      ? `/api/analyze/${analysisId}/full`
      : `/api/analyze/${analysisId}/step/${stepNum}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        // Non-streaming error response
        let errMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
          const body = await response.json() as { error?: string };
          if (body.error) errMsg = body.error;
        } catch { /* ignore */ }
        setState(s => ({ ...s, isStreaming: false, error: errMsg }));
        toast({ title: "Analysis Error", description: errMsg, variant: "destructive" });
        return;
      }

      if (!response.body) throw new Error("No readable stream from server");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let sseBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSEChunk(sseBuffer);
        sseBuffer = remaining;

        for (const data of events) {
          // Streaming content token
          if (typeof data.content === "string") {
            accumulatedText += data.content;
            setState(s => ({ ...s, content: accumulatedText }));
          }

          // Step starting or transitioning
          if (typeof data.step === "number") {
            setState(s => ({
              ...s,
              currentStep: data.step as number,
              stepName: (typeof data.stepName === "string" ? data.stepName : s.stepName),
            }));
          }

          // Step or full run complete — refresh results from DB
          if (data.done || data.stepComplete) {
            queryClient.invalidateQueries({ queryKey: getListResultsQueryKey(analysisId) });
            queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
          }

          // Server-side error embedded in stream
          if (typeof data.error === "string") {
            setState(s => ({ ...s, isStreaming: false, error: data.error as string }));
            toast({ title: "Analysis Error", description: data.error as string, variant: "destructive" });
            return;
          }
        }
      }

      setState(s => ({ ...s, isStreaming: false }));
      toast({ title: "Analysis Complete", description: "All steps finished. View the Results tab." });

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setState(s => ({ ...s, isStreaming: false, error: "Analysis stopped." }));
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState(s => ({ ...s, isStreaming: false, error: msg }));
        toast({ title: "Analysis Error", description: msg, variant: "destructive" });
      }
    } finally {
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey(analysisId) });
    }
  }, [analysisId, queryClient, toast]);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { ...state, startStream, stopStream };
}
