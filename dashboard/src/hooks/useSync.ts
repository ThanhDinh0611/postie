import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import {
  getSyncStatus,
  syncAllPosts
} from '@/api/client.ts';

export function useSync() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const syncStatusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getSyncStatus(token);
    }
  });

  const syncAllPostsMutation = useMutation({
    mutationFn: async (pageId?: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return syncAllPosts(token, pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    }
  });

  return {
    syncStatusQuery,
    syncAllPostsMutation
  };
}
