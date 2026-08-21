// news-fetch skill: 通过 GNews API 免费层获取新闻
// 支持两种模式:
//   1) search  (默认, 向后兼容)  node gnews_fetch.js "<query>" [lang] [max]
//   2) top     (头条, 推荐)       node gnews_fetch.js --top --category business --country cn --lang zh --max 8
// 依赖环境变量 GNEWS_API_KEY (运行时已注入)
const KEY = process.env.GNEWS_API_KEY;
if (!KEY) {
  console.error('ERROR: 缺少环境变量 GNEWS_API_KEY');
  process.exit(1);
}

// ---- 参数解析: 兼容旧 positional 用法 + 新 flagged 用法 ----
let mode = 'search';
let query = '';
let category = '';
let country = '';
let lang = 'en';
let max = '10';

// ---- arXiv 双源（论文模式）参数 ----
let arxiv = false;                                  // 是否启用 arXiv 源
let arxivMax = '12';                               // arXiv 拉取条数
let arxivCat = 'cs.CL,cs.LG,cs.AI';                // 聚焦类别（NLP / 机器学习 / AI）
let arxivQ = 'abs:"large language model" OR abs:"generative AI" OR abs:"diffusion model" OR ti:LLM';

const positionals = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  switch (a) {
    case '--top': mode = 'top'; break;
    case '--search': mode = 'search'; break;
    case '--category': category = args[++i]; break;
    case '--country': country = args[++i]; break;
    case '--lang': lang = args[++i]; break;
    case '--max': max = args[++i]; break;
    case '--q': query = args[++i]; break;
    case '--arxiv': arxiv = true; break;
    case '--arxiv-max': arxivMax = args[++i]; break;
    case '--arxiv-cat': arxivCat = args[++i]; break;
    case '--arxiv-q': arxivQ = args[++i]; break;
    default: positionals.push(a);
  }
}
// 旧用法兜底: node gnews_fetch.js "query" [lang] [max] （仅当未显式 --q 且首个 positional 非 flag 时）
if (mode === 'search' && !query && positionals.length && !positionals[0].startsWith('--')) {
  query = positionals[0];
  if (positionals[1]) lang = positionals[1];
  if (positionals[2]) max = positionals[2];
}
if (mode === 'top' && !category) category = 'general';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FETCH_TIMEOUT = 8000; // 单次请求超时(ms)，避免网络挂起拖慢整体

// ---- 限流/超时/网络异常 自动重试 (指数退避) ----
async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      const d = await r.json().catch(() => ({}));
      const errStr = JSON.stringify(d.errors || '');
      if (d.errors && /too many requests/i.test(errStr) && attempt < retries) {
        const wait = Math.min(3000 * Math.pow(2, attempt), 15000);
        console.error(`[限流] 第 ${attempt + 1} 次重试，等待 ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (d.errors) {
        console.error('GNews API error:', errStr);
        process.exit(1);
      }
      if (!Array.isArray(d.articles)) {
        console.error('[警告] 返回结构异常(无 articles)，可能参数有误或触发限流');
      }
      return d;
    } catch (e) {
      clearTimeout(timer);
      if (attempt < retries) {
        const wait = Math.min(2000 * Math.pow(2, attempt), 10000);
        console.error(`[网络/超时] 第 ${attempt + 1} 次重试，等待 ${wait}ms... (${e.name})`);
        await sleep(wait);
        continue;
      }
      console.error('请求失败:', e.name, e.message);
      process.exit(1);
    }
  }
}

// 规范化查询: 仅做 trim。注意 GNews 不接受带双引号的短语(会 syntax error)，空格多词原样传即可(默认按词匹配)
function normalizeQuery(q) {
  return (q || 'artificial intelligence').trim();
}

// 国家 -> 语言 映射: 获取某国新闻时自动使用该国语言(便于下游翻译/阅读)
// 同时支持 --country 语法中的显式语言 (如 us:12:en)，显式优先于本表
const COUNTRY_LANG = {
  us: 'en', gb: 'en', au: 'en', ca: 'en', nz: 'en', ie: 'en', sg: 'en', in: 'en', za: 'en',
  ng: 'en', gh: 'en', ke: 'en', et: 'en', na: 'en', ug: 'en', tz: 'en', zw: 'en', bw: 'en',
  de: 'de', at: 'de', ch: 'de',
  fr: 'fr',
  es: 'es', mx: 'es', co: 'es', cl: 'es', cu: 'es', ve: 'es', pe: 'es', ar: 'es',
  it: 'it',
  pt: 'pt', br: 'pt',
  nl: 'nl', be: 'nl',
  ru: 'ru', ua: 'uk',
  jp: 'ja',
  kr: 'ko',
  cn: 'zh', tw: 'zh', hk: 'zh',
  id: 'id', th: 'th', vn: 'vi', tr: 'tr',
  pl: 'pl', ro: 'ro', cz: 'cs', sk: 'sk', si: 'sl', hu: 'hu', gr: 'el',
  fi: 'fi', se: 'sv', no: 'no',
  il: 'he', pk: 'en', ph: 'en', my: 'en', bg: 'bg', lv: 'lv', lt: 'lt', ee: 'et'
};

// 根据国家代码推导语言(未命中则回退全局 --lang)
function langForCountry(c) {
  return (c && COUNTRY_LANG[c]) || lang;
}

// 本地化查询词映射: 当全局 --q 为默认 "artificial intelligence" 时，按各国语言自动翻译关键词
// (否则非英文国家搜英文词会匹配不到本地新闻)。可用 --country 的 @查询词 显式覆盖。
const QMAP = {
  en: 'artificial intelligence',
  de: 'künstliche Intelligenz',
  fr: 'intelligence artificielle',
  es: 'inteligencia artificial',
  it: 'intelligenza artificiale',
  pt: 'inteligência artificial',
  nl: 'kunstmatige intelligentie',
  ru: 'искусственный интеллект',
  ja: '人工知能',
  ko: '인공지능',
  zh: '人工智能',
  pl: 'sztuczna inteligencja',
  tr: 'yapay zeka',
  ar: 'الذكاء الاصطناعي',
  hi: 'कृत्रिम बुद्धिमत्ता'
};

function buildUrl(cat, ctry, m, segLang, segQuery) {
  const useLang = segLang || lang; // 单段语言(来自 --country 或国家映射)，否则全局 --lang
  const useMax = String(m != null ? m : max);
  // 单段查询词优先(来自 --country 的 @查询词)，否则用全局 --q
  const q = encodeURIComponent(segQuery != null ? segQuery : normalizeQuery(query));
  let endpoint, params;
  if (mode === 'top') {
    endpoint = 'https://gnews.io/api/v4/top-headlines';
    params = new URLSearchParams({ category: cat || 'general', lang: useLang, max: useMax, apikey: KEY });
    if (ctry) params.set('country', ctry);
    else if (country) params.set('country', country);
  } else {
    endpoint = 'https://gnews.io/api/v4/search';
    params = new URLSearchParams({ lang: useLang, max: useMax, sortby: 'publishedAt', apikey: KEY });
    if (ctry) params.set('country', ctry);
    return `${endpoint}?q=${q}&${params.toString()}`;
  }
  return `${endpoint}?${params.toString()}`;
}

function mapItems(d) {
  return (d.articles || []).map(a => ({
    title: a.title,
    url: a.url,
    source: a.source ? a.source.name : '',
    publishedAt: a.publishedAt,
    description: a.description
  }));
}

// ---- arXiv 源: 拉取最新 LLM/生成式论文（聚焦 cs.CL/cs.LG/cs.AI，零外部依赖）----
function buildArxivUrl(cat, kw, m) {
  const cats = (cat || 'cs.CL,cs.LG,cs.AI').split(',').map(s => s.trim()).filter(Boolean).map(c => `cat:${c}`).join(' OR ');
  const kwPart = kw ? ` AND (${kw})` : '';
  const sq = `(${cats})${kwPart}`;
  const params = new URLSearchParams({
    search_query: sq,
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    max_results: String(m != null ? m : arxivMax)
  });
  return `http://export.arxiv.org/api/query?${params.toString()}`;
}

// 轻量 Atom 解析（正则，不引依赖）：提取 title/summary/published/authors/pdf链接
function parseArxiv(xml) {
  const entries = xml.split('<entry>').slice(1);
  return entries.map(e => {
    const get = (tag) => {
      const m = e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };
    const title = get('title');
    const summary = get('summary');
    const published = get('published');
    const idUrl = get('id');
    const authors = [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)].map(m => m[1].trim());
    const pdf = (e.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/) || [])[1] || idUrl;
    return {
      title,
      url: pdf || idUrl,
      source: 'arXiv',
      publishedAt: published,
      description: summary,
      authors: authors.slice(0, 5).join(', ') + (authors.length > 5 ? ' 等' : ''),
      country: 'arxiv',
      lang: 'en',
      query: arxivQ,
      origin: 'arxiv'
    };
  }).filter(it => it.title);
}

async function fetchArxiv() {
  const url = buildArxivUrl(arxivCat, arxivQ, arxivMax);
  for (let attempt = 0; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const xml = await r.text();
      return parseArxiv(xml);
    } catch (e) {
      clearTimeout(timer);
      if (attempt < 3) {
        const wait = Math.min(2000 * Math.pow(2, attempt), 10000);
        console.error(`[arXiv 网络/超时] 第 ${attempt + 1} 次重试，等待 ${wait}ms... (${e.name})`);
        await sleep(wait);
        continue;
      }
      console.error('[arXiv] 请求失败，跳过该源:', e.name, e.message);
      return [];
    }
  }
  return [];
}

// ---- 主流程 ----
(async () => {
  // 构建请求段: top 按 category 拆分; search 按 country 拆分(支持 us:12:en 权重+语言语法)
  let segments = [];
  if (mode === 'top') {
    const cats = category.split(',').map(s => s.trim()).filter(Boolean);
    segments = (cats.length ? cats : ['general']).map(c => ({ cat: c, ctry: '', m: null, lang: null }));
  } else {
    const specs = (country || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
      // @查询词 作为每段独立查询(可含空格)，其余部分按 country[:weight][:lang] 解析
      let queryOverride = null;
      const atIdx = s.indexOf('@');
      let head = s;
      if (atIdx >= 0) { head = s.slice(0, atIdx); queryOverride = s.slice(atIdx + 1).trim(); }
      const parts = head.split(':');
      const c = parts[0];
      let m = null, l = null;
      if (parts.length >= 2) {
        if (/^\d+$/.test(parts[1])) m = parseInt(parts[1], 10); // 第2段是数字 => 权重
        else l = parts[1];                                      // 否则 => 语言
      }
      if (parts.length >= 3) l = parts[2];                      // 第3段 => 语言(显式优先)
      if (!l) l = langForCountry(c);                            // 未指定则按国家映射派生
      return { c, m, lang: l, query: queryOverride };
    });
    segments = specs.length
      ? specs.map(s => ({ cat: '', ctry: s.c, m: s.m, lang: s.lang, query: s.query }))
      : [{ cat: '', ctry: '', m: null, lang: null, query: null }];
  }
  let all = [];
  const seen = new Set();
  // 去重 key: 标题+来源 (避免同标题不同 URL 的重复，如同一媒体重复推送)
  const keyOf = (it) => `${(it.title || '').trim()}::${(it.source || '').trim()}`;
  // 全局 --q 是否为默认 AI 短语: 是则按各国语言自动本地化关键词(否则非英文国家搜英文词会落空)
  const userQ = normalizeQuery(query);
  const isDefaultAI = /artificial intelligence/i.test(userQ);
  for (const seg of segments) {
    const effectiveQ = seg.query || (isDefaultAI ? (QMAP[seg.lang] || userQ) : userQ);
    const data = await fetchWithRetry(buildUrl(seg.cat, seg.ctry, seg.m, seg.lang, effectiveQ));
    for (const it of mapItems(data)) {
      const k = keyOf(it);
      if (!seen.has(k)) {
        seen.add(k);
        // 写入 country/lang/query，便于下游按国家分板块、让翻译模型识别原文语种与用词
        all.push(Object.assign({}, it, { country: seg.ctry || '', lang: seg.lang || lang, query: effectiveQ, origin: 'gnews' }));
      }
    }
    if (segments.length > 1) await sleep(2000); // 批量错峰，规避 GNews 短时限流
  }
  // 双源: 合并 arXiv 最新 LLM/生成式论文（失败不影响 GNews 主结果）
  if (arxiv) {
    try {
      const ax = await fetchArxiv();
      for (const it of ax) {
        const k = keyOf(it);
        if (!seen.has(k)) { seen.add(k); all.push(it); }
      }
      console.error(`[arXiv] 合并 ${ax.length} 条论文`);
    } catch (e) {
      console.error('[arXiv] 合并跳过:', e.message);
    }
  }
  console.log(JSON.stringify({ mode, total: all.length, items: all }, null, 2));
})();
