// news-fetch skill: 两渠道 —— arXiv 最新论文 + AIHub 中文AI资讯
// 输出: [{ source, items }, ...]  顺序固定 aihub → arxiv
//   - aihub : AIHub 中文AI资讯，自然日近 2 天（无 description，省 token）
//   - arxiv : 最新 5 条 LLM/生成式论文（保留 description + authors）
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FETCH_TIMEOUT = 8000;

// 清洗文本：删除零宽/控制字符、压缩空白、去首尾空格
// 零宽/不可见字符：\u200B \u200C \u200D \u200E \u200F \uFEFF 及其他 C0/C1 控制字符
function cleanText(s) {
  if (!s) return '';
  return s
    .replace(/[\u0000-\u001F\u007F-\u009F\u00A0\u200B-\u200F\u2028\u2029\uFEFF]/g, '') // 删控制字符/零宽/不间断空格
    .replace(/\s+/g, ' ') // 连续空白压成单空格
    .trim();
}

async function getText(url, ua) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const opt = ua ? { signal: ctrl.signal, headers: { 'User-Agent': ua } } : { signal: ctrl.signal };
      const r = await fetch(url, opt);
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      clearTimeout(timer);
      if (attempt < 3) { await sleep(Math.min(2000 * Math.pow(2, attempt), 10000)); continue; }
      throw e;
    }
  }
}

// ---- arXiv: 最新 5 条 LLM/生成式论文（cs.CL/cs.LG/cs.AI）----
function arxivUrl() {
  const cats = 'cs.CL,cs.LG,cs.AI'.split(',').map(c => `cat:${c.trim()}`).join(' OR ');
  const kw = 'abs:"large language model" OR abs:"generative AI" OR abs:"diffusion model" OR ti:LLM';
  const params = new URLSearchParams({
    search_query: `(${cats}) AND (${kw})`,
    sortBy: 'submittedDate', sortOrder: 'descending', max_results: '5'
  });
  return `http://export.arxiv.org/api/query?${params.toString()}`;
}
function parseArxiv(xml) {
  return xml.split('<entry>').slice(1).map(e => {
    const get = (t) => { const m = e.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
    const authors = [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)].map(m => m[1].trim());
    const idUrl = get('id');
    const pdf = (e.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/) || [])[1] || idUrl;
    return {
      title: cleanText(get('title')), url: pdf || idUrl,
      publishedAt: get('published'), description: get('summary'),
      authors: authors.slice(0, 2).join(', ') + (authors.length > 2 ? ' 等' : '')
    };
  }).filter(it => it.title);
}
async function fetchArxiv() {
  try {
    const xml = await getText(arxivUrl());
    return parseArxiv(xml).slice(0, 5);
  } catch (e) {
    console.error('[arXiv] 失败跳过:', e.message); return [];
  }
}

// ---- AIBase: news.aibase.cn/news 第一页 AI新闻资讯（仅标题，省 token）----
const AIBASE_URL = 'https://news.aibase.cn/news';
function parseAibase(html) {
  if (!html) return [];
  const re = /<a href="\/news\/\d+"[^>]*>([\s\S]*?)<\/a>/g;
  const items = [];
  let m;
  while ((m = re.exec(html))) {
    const titleM = m[1].match(/font600 mainColor[\s\S]*?>([\s\S]*?)<\/div>/);
    if (!titleM) continue;
    const title = cleanText(titleM[1].replace(/<[^>]+>/g, ''));
    if (title) items.push({ title });
  }
  return items; // 第一页全部，不做时间筛选（相对时间不可靠；第一页即当天最新流）
}
async function fetchAibase() {
  try {
    const html = await getText(AIBASE_URL, 'Mozilla/5.0');
    return parseAibase(html);
  } catch (e) {
    console.error('[AIBase] 失败跳过:', e.message); return [];
  }
}

// ---- AIHub: aihub.cn/news 中文AI资讯（服务端渲染，零依赖）----
const AIHUB_URL = 'https://www.aihub.cn/news/';
function parseAihubDate(s) {
  const m = (s || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}
function parseAihub(html) {
  if (!html) return [];
  return html.split('<li class="post-3-li post-list-item"').slice(1).map(b => {
    const h2 = b.match(/<h2>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/);
    if (!h2) return null;
    const time = b.match(/<time[^>]*datetime="([^"]+)"[^>]*>/);
    const dateStr = time ? time[1] : '';
    return {
      title: cleanText(h2[2].replace(/<[^>]+>/g, '')),
      url: h2[1], publishedAt: dateStr, _date: parseAihubDate(dateStr)
    };
  }).filter(Boolean);
}
async function fetchAihub() {
  try {
    const html = await getText(AIHUB_URL, 'Mozilla/5.0');
    let items = parseAihub(html);
    if (items.length) {
      const now = new Date();
      const threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0); // 自然日近 2 天
      items = items.filter(it => it._date && it._date >= threshold).map(({ _date, ...rest }) => rest);
    }
    return items;
  } catch (e) {
    console.error('[AIHub] 失败跳过:', e.message); return [];
  }
}

const byTimeDesc = (a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '');

(async () => {
  const aihub = (await fetchAihub()).sort(byTimeDesc);
  console.error(`[AIHub] 近2天 ${aihub.length} 条`);
  const arxiv = (await fetchArxiv()).sort(byTimeDesc);
  console.error(`[arXiv] 取 ${arxiv.length} 条`);
  const aibase = await fetchAibase();
  console.error(`[AIBase] 第一页 ${aibase.length} 条`);
  // 顺序固定: aihub → arxiv → aibase
  const out = [
    { source: 'aihub', items: aihub },
    { source: 'arxiv', items: arxiv },
    { source: 'aibase', home: AIBASE_URL, items: aibase }
  ];
  // JSON 留 stderr 方便排查；stdout 仅输出 Markdown
  // console.error(JSON.stringify(out));

  const md = [];
  md.push('# AI 资讯快报');
  md.push('');

  // ---- AIHub ----
  md.push('## AIHub（近 2 天）');
  md.push('');
  if (aihub.length) {
    aihub.forEach(it => {
      md.push(`- ${it.title}`);
      md.push(`  - ${it.url} （${it.publishedAt}）`);
    });
  } else {
    md.push('- （无）');
  }
  md.push('');

  // ---- arXiv ----
  md.push('## arXiv（最新 5 条 · cs.CL/cs.LG/cs.AI + LLM/生成式）');
  md.push('');
  if (arxiv.length) {
    arxiv.forEach(it => {
      const desc = it.description ? ` — ${it.description.replace(/\s+/g, ' ').trim()}` : '';
      const auth = it.authors ? `  \n  - 作者：${it.authors}` : '';
      md.push(`- ${it.title}${desc}${auth}`);
      md.push(`  - ${it.url} （${it.publishedAt}）`);
    });
  } else {
    md.push('- （无）');
  }
  md.push('');

  // ---- AIBase ----
  md.push('## AIBase（第一页 · 当日最新流，仅标题）');
  md.push('');
  if (aibase.length) {
    aibase.forEach(it => md.push(`- ${it.title}`));
  } else {
    md.push('- （无）');
  }
  md.push('');
  md.push(`> 浏览全部：${AIBASE_URL}`);

  console.log(md.join('\n'));
})();
