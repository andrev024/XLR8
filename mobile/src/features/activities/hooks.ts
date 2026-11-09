import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { deleteActivity, fetchActivities, fetchActivity } from "./api";

const ACTIVITIES_PAGE_SIZE = 20;
const activitiesKey = ["activities"] as const;
const activityKey = (id: string) => ["activities", id] as const;

export function useActivitiesQuery() {
  return useInfiniteQuery({
    queryKey: activitiesKey,
    queryFn: ({ pageParam }) =>
      fetchActivities(pageParam, ACTIVITIES_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total
        ? lastPage.page + 1
        : undefined,
  });
}

export function useActivityQuery(id: string) {
  return useQuery({
    queryKey: activityKey(id),
    queryFn: () => fetchActivity(id),
    enabled: Boolean(id),
  });
}

export function useDeleteActivityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteActivity,
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: activitiesKey });
      void queryClient.removeQueries({ queryKey: activityKey(id) });
    },
  });
}
