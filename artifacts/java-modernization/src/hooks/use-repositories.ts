import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  listRepositories,
  createRepository,
  deleteRepository,
  getListRepositoriesQueryKey,
  getGetAnalysisQueryKey,
  type CreateRepositoryBody
} from "@workspace/api-client-react";

export function useRepositories(analysisId: number) {
  return useQuery({
    queryKey: getListRepositoriesQueryKey(analysisId),
    queryFn: () => listRepositories(analysisId),
    enabled: !!analysisId
  });
}

export function useCreateRepository(analysisId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRepositoryBody) => createRepository(analysisId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRepositoriesQueryKey(analysisId) });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
    }
  });
}

export function useDeleteRepository(analysisId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repoId: number) => deleteRepository(analysisId, repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRepositoriesQueryKey(analysisId) });
    }
  });
}
