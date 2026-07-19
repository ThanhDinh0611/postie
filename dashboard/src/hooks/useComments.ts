import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { getPostComments } from '@/api/client.ts';

export function useComments(postId: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      if (!postId) return { comments: [], replies: [], totalCount: 0 };
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getPostComments(postId, token);
    },
    enabled: !!postId
  });
}
