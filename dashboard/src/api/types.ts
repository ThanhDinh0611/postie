export interface PageData {
  id: string;
  facebook_page_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  is_active: number;
}

export interface PostData {
  id: string;
  page_id: string;
  facebook_post_id: string | null;
  permalink: string | null;
  message: string;
  media_url: string | null;
  post_format: string;
  hook_type: string | null;
  copywriting_formula: string | null;
  tone: string | null;
  status: string;
  created_at: number;
  published_at: number | null;
  page_name?: string;
  campaign_id?: string | null;
  generation_id?: string | null;
  likes?: number;
  comments_count?: number;
  shares?: number;
  views?: number;
  engagement_fetched_at?: number | null;
  campaign_title?: string;
  campaign_color?: string;
  reel_duration?: number | null;
  video_url?: string | null;
  script_segments?: string | null;
}

export interface CampaignData {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string;
  created_at: number;
}

export interface PageAnalysisData {
  id: string;
  pageId: string;
  analyzedAt: number;
  summary: string;
  writingStyleInstructions: string;
  suggestions: Array<{ title: string; description: string; priority: 'High' | 'Medium' | 'Low' }>;
  contentTypePerformance: {
    reelsEngagementRate?: number;
    videosEngagementRate?: number;
    imagesEngagementRate?: number;
    textOnlyEngagementRate?: number;
    [key: string]: number | undefined;
  };
  chartsData: {
    engagementByFormat: Array<{ format: string; avgEngagementRate: number }>;
    engagementByFormula: Array<{ formula: string; avgEngagementRate: number }>;
    postVolumeByMonth: Array<{ month: string; postCount: number }>;
    engagementByHook: Array<{ hook: string; avgEngagementRate: number }>;
  };
  metricsSummary: {
    topPerformingHook: string;
    topPerformingFormula: string;
    topPerformingFormat: string;
    bestPostingDayAndTime: string;
    avgEngagementRate: number;
    totalReachViews: number;
  };
}

export interface GenerateRequest {
  topic: string;
  hookType: string;
  formula: string;
  tone: string;
  postFormat?: 'Post' | 'Reel' | 'Video';
  publishType?: 'image' | 'link';
  wikiSlug?: string;
  allowWebSearch?: boolean;
  reelDuration?: number;
}

export interface ReelScriptSegment {
  visual: string;
  voiceover: string;
  durationSec: number;
}

export interface GenerateResponse {
  content: string;
  selectedHook: string;
  formulaApplied: string;
  variants: string[];
  generationId: string;
  tokenUsage: { input: number; output: number; total: number } | null;
  tone?: string;
  linkTitle?: string;
  linkDescription?: string;
  scriptSegments?: ReelScriptSegment[];
  reelDuration?: number;
}

export interface PublishRequest {
  content: string;
  pageId?: string;
  mediaUrl?: string;
  scheduledAt?: number;
  hookType?: string;
  formula?: string;
  tone?: string;
  postFormat?: string;
  campaignId?: string;
  generationId?: string;
  publishType?: 'image' | 'link';
  targetUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
}

export interface PublishResponse {
  postId: string;
  facebookPostId: string;
  permalink: string;
  status: string;
}

export interface UploadResponse {
  image_url: string;
  fileName: string;
}

export interface VideoUploadResponse {
  video_url: string;
  fileName: string;
}

export interface PublishReelRequest {
  videoUrl: string;
  caption: string;
  pageId?: string;
  scheduledAt?: number;
  reelDuration?: number;
  scriptSegments?: string;
  hookType?: string;
  formula?: string;
  tone?: string;
  campaignId?: string;
  generationId?: string;
  contentCategory?: string;
}

export const REEL_CATEGORIES = [
  'BEAUTY_FASHION', 'BUSINESS', 'CARS_TRUCKS', 'COMEDY', 'CUTE_ANIMALS',
  'ENTERTAINMENT', 'FAMILY', 'FOOD_HEALTH', 'HOME', 'LIFESTYLE',
  'MUSIC', 'NEWS', 'POLITICS', 'SCIENCE', 'SPORTS',
  'TECHNOLOGY', 'VIDEO_GAMING', 'OTHER',
] as const;

export interface PublishReelResponse {
  postId: string;
  facebookPostId: string;
  permalink: string;
  status: string;
}

export interface SyncEngagement {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface SyncResultItem {
  postId: string;
  facebookPostId: string | null;
  message: string;
  pageName: string;
  status: string;
  engagement: SyncEngagement | null;
  syncedAt: number;
}

export interface SyncStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;
}

export interface SyncResponse {
  success: boolean;
  duration: string;
  totalFetched: number;
  totalSynced: number;
  pages: number;
  pageNames?: string[];
  subrequestsUsed?: number;
  hasMore?: boolean;
  results: SyncResultItem[];
  stats: SyncStats;
}

export interface SyncStatusResponse {
  totalPosts: number;
  pageCount: number;
  pages: Array<{ id: string; name: string; username: string | null }>;
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalViews: number;
  };
  lastSyncAt: number | null;
}

export interface PostEngagementResponse {
  id: string;
  message: string;
  permalink: string | null;
  page_name: string;
  status: string;
  published_at: number | null;
  facebook_post_id: string | null;
  engagement: {
    likes: number;
    comments_count: number;
    shares: number;
    views: number;
    fetched_at: number;
  } | null;
}

export interface CommentData {
  id: string;
  facebook_comment_id: string;
  post_id: string;
  from_name: string | null;
  from_id: string | null;
  message: string;
  like_count: number;
  created_time: number | null;
  parent_id: string | null;
  fetched_at: number;
}

export interface CommentsResponse {
  comments: CommentData[];
  replies: CommentData[];
  totalCount: number;
}
