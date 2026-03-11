import { useQuery } from "@tanstack/react-query";
import { 
  listResults,
  getListResultsQueryKey
} from "@workspace/api-client-react";

export function useResults(analysisId: number) {
  return useQuery({
    queryKey: getListResultsQueryKey(analysisId),
    queryFn: () => listResults(analysisId),
    enabled: !!analysisId
  });
}
