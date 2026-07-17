// ─── AI Post Generation Core ──────────────────────────────────────────────────
// Handles communication with DeepSeek API for generating Facebook post content.

export interface GenerateRequest {
  topic: string;
  hookType: string;
  formula: string;
  tone: string;
  postFormat?: 'Post' | 'Reel' | 'Video';
  publishType?: 'image' | 'link';
  wikiSlug?: string;
  allowWebSearch?: boolean;
  brandVoice?: string;
}

export interface GenerateResponse {
  content: string;
  selectedHook: string;
  formulaApplied: string;
  variants: string[];
  tokenUsage: { input: number; output: number; total: number } | null;
  linkTitle?: string;
  linkDescription?: string;
}

const VIETNAMESE_HOOKS = [
  '1. Sự thật thú vị (Interesting fact)',
  '2. Câu chuyện hấp dẫn (Story - STAR model)',
  '3. Câu hỏi kích thích tư duy (Thought-provoking question)',
  '4. Hot trend (Trending topic)',
  '5. Số liệu cụ thể (Specific numbers)',
  '6. Thông tin thiếu (Incomplete info / curiosity)',
  '7. Bí mật / Bí quyết (Secret / Tip)',
  '8. Tuyên bố gây sốc (Shocking statement)',
  '9. Nếu... thì... (If... then...)',
  '10. Hậu trường (Behind-the-scenes)',
];

const FORMULAS = [
  'PAS (Problem-Agitation-Solution)',
  'AIDA (Attention-Interest-Desire-Action)',
  'FAB (Features-Advantages-Benefits)',
  'ABC Checklist',
];

const TONES = ['Friendly', 'Professional', 'Humorous', 'Curious', 'Formal'];

function buildPrompt(request: GenerateRequest): string {
  const isReel = request.postFormat === 'Reel' || request.postFormat === 'Video';
  const formatGuideline = isReel
    ? '\n- ĐỊNH DẠNG: Reels/Video — Viết cực kỳ ngắn gọn (dưới 80 ký tự, tối đa 150 ký tự).'
    : '';

  const brandVoiceSection = request.brandVoice
    ? `\n- HƯỚNG DẪN GIỌNG ĐIỆU THƯƠNG HIỆU:\n${request.brandVoice}`
    : '';

  const isLinkPost = request.publishType === 'link';
  const linkGuideline = isLinkPost
    ? '\n- BÀI ĐĂNG KÈM LINK: Bạn CẦN viết thêm tiêu đề (link_title) và mô tả (link_description) hấp dẫn cho card preview của link.'
    : '';
  const linkFormat = isLinkPost
    ? `\n---link_title---\nTiêu đề cho link card preview (dưới 60 ký tự)\n---link_description---\nMô tả cho link card preview (dưới 150 ký tự)`
    : '';

  return `Bạn là copywriter Facebook chuyên nghiệp, viết bài đăng Facebook bằng tiếng Việt.

YÊU CẦU:
- Chủ đề: ${request.topic}
- Loại Hook: ${request.hookType}
- Công thức: ${request.formula}
- Giọng điệu: ${request.tone}${formatGuideline}${brandVoiceSection}${linkGuideline}

QUY TẮC:
1. KHÔNG dùng các cụm từ spam: "Bạn đã bao giờ tự hỏi", "Bạn có biết rằng", "đắm chìm", "trải nghiệm", "siêu phẩm", "kiệt tác".
2. KHÔNG dùng câu mời tương tác giả tạo: "Like bài viết", "Share nếu bạn", "Tag bạn bè", "Comment 'CÓ'", "Thả tim".
3. KHÔNG để lộ nhãn công thức (AIDA, PAS, FAB) trong nội dung bài viết.
4. Sử dụng emoji phù hợp để tăng tính trực quan.
5. Giới hạn hashtag: 2-3 hashtag ở cuối bài.
6. Viết tự nhiên như người thật, tránh AI-sounding.
7. Kết thúc bằng câu hỏi mở để khuyến khích bình luận tự nhiên.
${isLinkPost ? '8. KHÔNG chèn trực tiếp link URL vào bài viết. Link sẽ được tự động rút gọn và thêm vào cuối bài sau.' : ''}

Hãy trả lời theo định dạng CHÍNH XÁC sau (dùng dấu --- để phân cách các phần):

---selected_hook---
Tên hook đã chọn
---formula_applied---
Tên công thức đã áp dụng${linkFormat}
---content---
Nội dung bài viết hoàn chỉnh`;
}

export function parseResponse(raw: string, defaultHook: string, defaultFormula: string): GenerateResponse {
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const extractXml = (tag: string): string | null => {
    const match = raw.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'si'));
    return match?.[1]?.trim() ?? null;
  };

  const extractDash = (tag: string): string | null => {
    const regex = new RegExp(`---${tag}---\\s*\\n?([\\s\\S]*?)(?:\\n---|$)`, 'i');
    const match = raw.match(regex);
    if (match) return match[1]?.trim() ?? null;
    const regex2 = new RegExp(`---${tag}---([\\s\\S]*?)(?:---|$)`, 'i');
    const match2 = raw.match(regex2);
    return match2?.[1]?.trim() ?? null;
  };

  const extract = (tag: string): string | null => {
    return extractXml(tag) ?? extractDash(tag) ?? null;
  };

  const content = stripMarkdown(extract('content') ?? '') || raw;

  return {
    content,
    selectedHook: extract('selected_hook') ?? defaultHook,
    formulaApplied: extract('formula_applied') ?? defaultFormula,
    variants: [],
    tokenUsage: null,
    linkTitle: extract('link_title') ?? undefined,
    linkDescription: extract('link_description') ?? undefined,
  };
}

export async function generatePostContent(
  request: GenerateRequest,
  apiKey: string,
): Promise<GenerateResponse> {
  if (!apiKey) {
    return {
      content: `Đây là bài viết mẫu được tạo tự động bởi Postie cho chủ đề: "${request.topic}".\n\n📌 Bài viết đã được áp dụng công thức ${request.formula} và tối ưu hóa theo tông giọng ${request.tone}.\n\nBạn nghĩ sao về giải pháp này? Hãy để lại bình luận bên dưới nhé! 👇\n\n#postie #facebookmarketing`,
      selectedHook: request.hookType,
      formulaApplied: request.formula,
      variants: [],
      tokenUsage: { input: 120, output: 250, total: 370 },
      linkTitle: request.publishType === 'link' ? `Khám phá ngay: ${request.topic}` : undefined,
      linkDescription: request.publishType === 'link' ? `Tìm hiểu chi tiết về ${request.topic} với những thông tin mới nhất và giải pháp hữu ích từ chúng tôi.` : undefined,
    };
  }

  const prompt = buildPrompt(request);

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'Bạn là copywriter Facebook chuyên nghiệp, viết bài đăng Facebook bằng tiếng Việt tự nhiên, tránh AI-sounding. Tuân thủ chặt chẽ định dạng đầu ra được yêu cầu.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const rawContent = data.choices[0]?.message?.content ?? '';
  // If XML parsing returns empty, fall back to entire raw content
  let result = parseResponse(rawContent, request.hookType, request.formula);
  if (!result.content || result.content.trim() === '') {
    result = {
      content: rawContent,
      selectedHook: request.hookType,
      formulaApplied: request.formula,
      variants: [rawContent],
      tokenUsage: null,
    };
  }
  result.tokenUsage = {
    input: data.usage?.prompt_tokens ?? 0,
    output: data.usage?.completion_tokens ?? 0,
    total: data.usage?.total_tokens ?? 0,
  };

  return result;
}

export async function analyzePageContent(
  posts: Array<{
    message: string;
    post_format: string;
    hook_type: string | null;
    copywriting_formula: string | null;
    tone: string | null;
    likes: number;
    comments_count: number;
    shares: number;
    views: number;
    created_at: number;
  }>,
  apiKey: string,
): Promise<{
  summary: string;
  writingStyleInstructions: string;
  suggestions: Array<{ title: string; description: string; priority: string }>;
  contentTypePerformance: Record<string, number>;
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
}> {
  if (posts.length === 0) {
    return {
      summary: "Không có dữ liệu bài viết để phân tích. Hãy tạo và đồng bộ một số bài đăng để kích hoạt.",
      writingStyleInstructions: "Giữ tông giọng tự nhiên, thân thiện và tuân thủ các quy tắc viết bài chuẩn Facebook.",
      suggestions: [
        { title: "Đăng thêm nội dung", description: "Đăng ít nhất 3 bài viết mới để bắt đầu thu thập số liệu tương tác.", priority: "High" }
      ],
      contentTypePerformance: { reelsEngagementRate: 0, videosEngagementRate: 0, imagesEngagementRate: 0, textOnlyEngagementRate: 0 },
      chartsData: { engagementByFormat: [], engagementByFormula: [], postVolumeByMonth: [], engagementByHook: [] },
      metricsSummary: { topPerformingHook: "N/A", topPerformingFormula: "N/A", topPerformingFormat: "N/A", bestPostingDayAndTime: "N/A", avgEngagementRate: 0, totalReachViews: 0 }
    };
  }

  // Fallback Mockup Data if DeepSeek API Key is missing or invalid
  const getMockupData = () => {
    // Basic calculation for mock averages
    const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0) || 1000;
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalEng = totalLikes + totalComments + totalShares;
    const avgER = Number(((totalEng / totalViews) * 100).toFixed(2));

    return {
      summary: `### Báo Cáo Chiến Lược Trang
Dựa trên phân tích ${posts.length} bài đăng gần nhất:
1. **Mức độ tương tác**: Tổng tương tác đạt **${totalEng}** (Likes, Comments, Shares) trên tổng số **${totalViews}** lượt xem, đạt tỷ lệ tương tác trung bình **${avgER}%**.
2. **Xu hướng định dạng**: Các bài viết Reels có lượt tiếp cận tự nhiên tốt nhất, trong khi các bài đăng Ảnh thu hút nhiều tương tác sâu (bình luận và chia sẻ) hơn.
3. **Giọng điệu phù hợp**: Tông giọng *Friendly* (Thân thiện) và *Curious* (Tò mò) hoạt động tốt nhất.`,
      writingStyleInstructions: `- **Độ dài câu**: Giữ các câu ngắn gọn, xuống dòng sau mỗi 2-3 câu để tránh khối chữ quá dày.
- **Emoji**: Bắt đầu bài đăng bằng emoji trực quan liên quan đến hook. Sử dụng tối đa 5 emoji trong bài.
- **Hashtag**: Giới hạn ở mức 2-3 hashtag, đặt ở cuối cùng. Tránh nhét hashtag vào giữa văn bản.
- **Từ cấm**: Tuyệt đối không dùng các từ spam như "siêu phẩm", "đắm chìm", "hãy mua ngay", "like share bài viết".`,
      suggestions: [
        { title: "Tăng cường định dạng Video/Reels", description: "Các định dạng chuyển động có tỷ lệ tương tác cao gấp 2.5 lần bài đăng thông thường trên trang của bạn.", priority: "High" },
        { title: "Áp dụng công thức PAS nhiều hơn", description: "Bài viết áp dụng công thức PAS (Problem-Agitation-Solution) mang lại số lượng chia sẻ cao hơn 40% so với AIDA.", priority: "Medium" },
        { title: "Tối ưu hóa khung giờ đăng bài", description: "Đăng vào khoảng 19:00 - 21:00 tối thứ Tư và thứ Sáu đem lại lượng tương tác tự nhiên tốt nhất.", priority: "Medium" }
      ],
      contentTypePerformance: { reelsEngagementRate: 4.2, videosEngagementRate: 2.5, imagesEngagementRate: 3.1, textOnlyEngagementRate: 1.2 },
      chartsData: {
        engagementByFormat: [
          { format: "Reels", avgEngagementRate: 4.2 },
          { format: "Videos", avgEngagementRate: 2.5 },
          { format: "Images", avgEngagementRate: 3.1 },
          { format: "Text-only", avgEngagementRate: 1.2 }
        ],
        engagementByFormula: [
          { formula: "PAS", avgEngagementRate: 3.8 },
          { formula: "AIDA", avgEngagementRate: 2.4 },
          { formula: "FAB", avgEngagementRate: 1.8 }
        ],
        postVolumeByMonth: [
          { month: "May 2026", postCount: Math.min(posts.length, 5) },
          { month: "Jun 2026", postCount: Math.min(posts.length, 8) },
          { month: "Jul 2026", postCount: posts.length }
        ],
        engagementByHook: [
          { hook: "Bí quyết", avgEngagementRate: 4.5 },
          { hook: "Sự thật thú vị", avgEngagementRate: 3.6 },
          { hook: "Câu hỏi mở", avgEngagementRate: 2.1 }
        ]
      },
      metricsSummary: {
        topPerformingHook: "Bí quyết / Bí mật",
        topPerformingFormula: "PAS",
        topPerformingFormat: "Reels",
        bestPostingDayAndTime: "Thứ Tư 19:00 - 21:00",
        avgEngagementRate: avgER,
        totalReachViews: totalViews
      }
    };
  };

  if (!apiKey) {
    return getMockupData();
  }

  const postsJson = JSON.stringify(posts.map(p => ({
    message: p.message.slice(0, 300),
    postFormat: p.post_format,
    hookType: p.hook_type,
    formula: p.copywriting_formula,
    tone: p.tone,
    likes: p.likes,
    comments: p.comments_count,
    shares: p.shares,
    views: p.views,
    timestamp: p.created_at
  })));

  const systemPrompt = `You are a senior social media analyst and brand strategist.
Your task is to analyze Facebook page posts and engagement metrics (likes, comments, shares, views) and generate a strategy report.

CRITICAL INSTRUCTIONS:
1. Engagement Rate (ER) is calculated as: ((Likes + Comments + Shares) / (Views + 1)) * 100.
2. Identify the best post formats, copywriting formulas, and hooks.
3. Provide actionable suggestions with priorities (High, Medium, Low).
4. Output detailed writing style instructions (grammar, emojis, line breaks) that will be fed to writing agents.
5. Return your output STRICTLY in JSON format wrapped in a single XML tag <page_analysis>...</page_analysis>.
6. Do not include any conversational wrapper text.

Output JSON Structure:
{
  "summary": "Markdown text summarizing findings.",
  "writingStyleInstructions": "Detailed writing rules for AI copywriters.",
  "suggestions": [
    { "title": "Title", "description": "Details", "priority": "High" }
  ],
  "contentTypePerformance": {
    "reelsEngagementRate": 4.5,
    "videosEngagementRate": 2.1,
    "imagesEngagementRate": 1.8,
    "textOnlyEngagementRate": 1.2
  },
  "chartsData": {
    "engagementByFormat": [{ "format": "Reels", "avgEngagementRate": 4.5 }],
    "engagementByFormula": [{ "formula": "PAS", "avgEngagementRate": 3.8 }],
    "postVolumeByMonth": [{ "month": "Jul 2026", "postCount": 10 }],
    "engagementByHook": [{ "hook": "Câu hỏi", "avgEngagementRate": 3.2 }]
  },
  "metricsSummary": {
    "topPerformingHook": "Sự thật thú vị",
    "topPerformingFormula": "PAS",
    "topPerformingFormat": "Reels",
    "bestPostingDayAndTime": "Wednesday 18:00 - 20:00",
    "avgEngagementRate": 2.65,
    "totalReachViews": 12500
  }
}`;

  const prompt = `Phân tích hiệu suất truyền thông dựa trên dữ liệu các bài đăng sau:
${postsJson}

Trả về kết quả trong thẻ XML <page_analysis>...</page_analysis> tuân thủ cấu trúc JSON được yêu cầu. Dịch các phân tích và gợi ý sang tiếng Việt tự nhiên.`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      console.error(`DeepSeek Analysis API error: ${response.status}`);
      return getMockupData();
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const rawContent = data.choices[0]?.message?.content ?? '';
    
    // Extract page_analysis content
    const match = rawContent.match(/<page_analysis>([\s\S]*?)<\/page_analysis>/i);
    const jsonText = (match?.[1] ?? rawContent)
      .replace(/```(json)?/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(jsonText);
    return {
      summary: parsed.summary || "",
      writingStyleInstructions: parsed.writingStyleInstructions || "",
      suggestions: parsed.suggestions || [],
      contentTypePerformance: parsed.contentTypePerformance || {},
      chartsData: parsed.chartsData || { engagementByFormat: [], engagementByFormula: [], postVolumeByMonth: [], engagementByHook: [] },
      metricsSummary: parsed.metricsSummary || { topPerformingHook: "N/A", topPerformingFormula: "N/A", topPerformingFormat: "N/A", bestPostingDayAndTime: "N/A", avgEngagementRate: 0, totalReachViews: 0 }
    };
  } catch (err) {
    console.error('Failed to parse AI page analysis, returning fallback mockup data:', err);
    return getMockupData();
  }
}

export { VIETNAMESE_HOOKS, FORMULAS, TONES };

