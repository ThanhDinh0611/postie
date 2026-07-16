// ─── AI Post Generation Core ──────────────────────────────────────────────────
// Handles communication with DeepSeek API for generating Facebook post content.

export interface GenerateRequest {
  topic: string;
  hookType: string;
  formula: string;
  tone: string;
  postFormat?: 'Post' | 'Reel' | 'Video';
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

  return `Bạn là copywriter Facebook chuyên nghiệp, viết bài đăng Facebook bằng tiếng Việt.

YÊU CẦU:
- Chủ đề: ${request.topic}
- Loại Hook: ${request.hookType}
- Công thức: ${request.formula}
- Giọng điệu: ${request.tone}${formatGuideline}${brandVoiceSection}

QUY TẮC:
1. KHÔNG dùng các cụm từ spam: "Bạn đã bao giờ tự hỏi", "Bạn có biết rằng", "đắm chìm", "trải nghiệm", "siêu phẩm", "kiệt tác".
2. KHÔNG dùng câu mời tương tác giả tạo: "Like bài viết", "Share nếu bạn", "Tag bạn bè", "Comment 'CÓ'", "Thả tim".
3. KHÔNG để lộ nhãn công thức (AIDA, PAS, FAB) trong nội dung bài viết.
4. Sử dụng emoji phù hợp để tăng tính trực quan.
5. Giới hạn hashtag: 2-3 hashtag ở cuối bài.
6. Viết tự nhiên như người thật, tránh AI-sounding.
7. Kết thúc bằng câu hỏi mở để khuyến khích bình luận tự nhiên.

Hãy trả lời theo định dạng CHÍNH XÁC sau (dùng dấu --- để phân cách các phần):

---selected_hook---
Tên hook đã chọn
---formula_applied---
Tên công thức đã áp dụng
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

  // Try XML tags first (<tag>...</tag>)
  const extractXml = (tag: string): string | null => {
    const match = raw.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'si'));
    return match?.[1]?.trim() ?? null;
  };

  // Try ---tag--- delimiter format
  const extractDash = (tag: string): string | null => {
    const regex = new RegExp(`---${tag}---\\s*\\n?([\\s\\S]*?)(?:\\n---|$)`, 'i');
    const match = raw.match(regex);
    if (match) return match[1]?.trim() ?? null;
    // Alternative: try with \n before ---
    const regex2 = new RegExp(`---${tag}---([\\s\\S]*?)(?:---|$)`, 'i');
    const match2 = raw.match(regex2);
    return match2?.[1]?.trim() ?? null;
  };

  // Helper: try both formats
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

export { VIETNAMESE_HOOKS, FORMULAS, TONES };
