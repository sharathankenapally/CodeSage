import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  listAnalyses, 
  createAnalysis, 
  getAnalysis, 
  deleteAnalysis,
  getListAnalysesQueryKey,
  getGetAnalysisQueryKey,
  type CreateAnalysisBody
} from "@workspace/api-client-react";

export function useAnalyses() {
  return useQuery({
    queryKey: getListAnalysesQueryKey(),
    queryFn: () => listAnalyses()
  });
}

export function useAnalysis(id: number) {
  return useQuery({
    queryKey: getGetAnalysisQueryKey(id),
    queryFn: () => getAnalysis(id),
    enabled: !!id
  });
}

export function useCreateAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnalysisBody) => createAnalysis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
    }
  });
}

export function useDeleteAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAnalysis(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
    }
  });
}
