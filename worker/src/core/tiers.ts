// ─── Tier Capabilities Configuration ──────────────────────────────────────────

export interface TierCapabilities {
  maxPostsPerMonth: number;
  maxGenerationsPerDay: number;
  allowCustomBrandVoice: boolean;
  allowWebSearch: boolean;
  allowReels: boolean;
}

const TIER_CAPS: Record<string, TierCapabilities> = {
  free: {
    maxPostsPerMonth: 10,
    maxGenerationsPerDay: 5,
    allowCustomBrandVoice: false,
    allowWebSearch: false,
    allowReels: false,
  },
  pro: {
    maxPostsPerMonth: Infinity,
    maxGenerationsPerDay: Infinity,
    allowCustomBrandVoice: true,
    allowWebSearch: true,
    allowReels: true,
  },
  team: {
    maxPostsPerMonth: Infinity,
    maxGenerationsPerDay: Infinity,
    allowCustomBrandVoice: true,
    allowWebSearch: true,
    allowReels: true,
  },
};

export function getTierCapabilities(tier: string): TierCapabilities {
  return (TIER_CAPS[tier] ?? TIER_CAPS.free) as TierCapabilities;
}
