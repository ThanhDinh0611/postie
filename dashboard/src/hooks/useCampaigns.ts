import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign
} from '../api.ts';

export function useCampaigns() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getCampaigns(token);
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; color?: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return createCampaign(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title?: string; description?: string; color?: string } }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return updateCampaign(id, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return deleteCampaign(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  return {
    campaignsQuery,
    createCampaignMutation,
    updateCampaignMutation,
    deleteCampaignMutation
  };
}
