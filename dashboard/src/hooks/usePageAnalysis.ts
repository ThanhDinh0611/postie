import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { getPageAnalysis } from '@/api/client.ts';

export function usePageAnalysis(pageId: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['page-analysis', pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getPageAnalysis(pageId, token);
    },
    enabled: !!pageId
  });
}
