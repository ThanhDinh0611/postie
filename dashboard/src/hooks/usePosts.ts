import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import {
  getPosts,
  generatePost,
  publishPost,
  publishReelPost,
  clearPostCache,
  uploadImage,
  uploadVideo,
  createPostComment,
  generateComment,
  deletePost,
  deletePostComment,
} from '@/api/client.ts';
import type { GenerateRequest, PublishRequest, PublishReelRequest } from '@/api/types.ts';

export function usePosts(filters?: { status?: string; pageId?: string; campaignId?: string; format?: string; sortBy?: string; offset?: number; limit?: number }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ['posts', filters],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getPosts(token, filters);
    },
    placeholderData: (prev) => prev
  });

  const generatePostMutation = useMutation({
    mutationFn: async (request: GenerateRequest) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return generatePost(request, token);
    }
  });

  const publishPostMutation = useMutation({
    mutationFn: async (request: PublishRequest) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return publishPost(request, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  const clearCacheMutation = useMutation({
    mutationFn: async (postId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return clearPostCache(postId, token);
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return uploadImage(file, token);
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return deletePost(postId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, message, attachmentUrl }: { postId: string; message: string; attachmentUrl?: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return createPostComment(postId, message, token, attachmentUrl);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  });

  const publishReelMutation = useMutation({
    mutationFn: async (request: PublishReelRequest) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return publishReelPost(request, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    }
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return uploadVideo(file, token);
    }
  });

  const generateCommentMutation = useMutation({
    mutationFn: async ({ postId, params }: { postId: string; params: { useClipy: boolean; targetUrl?: string; linkTitle?: string; linkDescription?: string; imageUrl?: string } }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return generateComment(postId, params, token);
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ postId, commentId }: { postId: string; commentId: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return deletePostComment(postId, commentId, token);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    }
  });

  return {
    postsQuery,
    generatePostMutation,
    publishPostMutation,
    publishReelMutation,
    clearCacheMutation,
    uploadImageMutation,
    uploadVideoMutation,
    deletePostMutation,
    createCommentMutation,
    generateCommentMutation,
    deleteCommentMutation
  };
}
