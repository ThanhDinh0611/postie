import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import {
  getPages,
  oauthConnectPages,
  deletePage,
  selectActivePage,
  getPageAnalysis,
  analyzePage
} from '../api.ts';

export function usePages() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const pagesQuery = useQuery({
    queryKey: ['pages'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getPages(token);
    }
  });

  const connectPagesMutation = useMutation({
    mutationFn: async ({ code, redirectUri }: { code: string; redirectUri: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return oauthConnectPages(code, redirectUri, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return deletePage(pageId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  const selectPageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return selectActivePage(pageId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    }
  });

  const usePageAnalysis = (pageId: string) => {
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
  };

  const analyzePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return analyzePage(pageId, token);
    },
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: ['page-analysis', pageId] });
    }
  });

  return {
    pagesQuery,
    connectPagesMutation,
    deletePageMutation,
    selectPageMutation,
    usePageAnalysis,
    analyzePageMutation
  };
}
