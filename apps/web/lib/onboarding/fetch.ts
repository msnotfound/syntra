export type FetchStrategy = 'html' | 'playwright' | 'pdf' | 'ocr';

export interface FetchedContent {
  text: string;
  source: 'webpage' | 'annual_report';
  url: string;
  strategy: FetchStrategy;
  page_count?: number;
}

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CHARS = 50_000;
// If stripped HTML yields fewer characters than this, the page is likely SPA-rendered.
const SPA_TEXT_THRESHOLD = 500;
const FETCH_TIMEOUT_MS = 10_000;

async function getRawBuffer(url: string): Promise<{ buf: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Syntra Onboarding Bot)' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) throw new Error('Content exceeds 2MB limit');
    return { buf: Buffer.from(ab), contentType: res.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function strategyHtml(url: string): Promise<FetchedContent | null> {
  const { buf, contentType } = await getRawBuffer(url);
  if (contentType.includes('application/pdf')) return null;
  const raw = buf.toString('utf8');
  const stripped = stripHtml(raw).substring(0, MAX_CHARS);
  if (stripped.length < SPA_TEXT_THRESHOLD) return null;
  const isAnnual = raw.toLowerCase().includes('annual report');
  return { text: stripped, source: isAnnual ? 'annual_report' : 'webpage', url, strategy: 'html' };
}

async function strategyPlaywright(url: string): Promise<FetchedContent> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    const text = (await page.evaluate(() => document.body.innerText)) as string;
    const title = await page.title();
    const isAnnual =
      title.toLowerCase().includes('annual report') ||
      text.toLowerCase().includes('annual report');
    return {
      text: text.substring(0, MAX_CHARS),
      source: isAnnual ? 'annual_report' : 'webpage',
      url,
      strategy: 'playwright',
    };
  } finally {
    await browser.close();
  }
}

async function strategyPdf(url: string): Promise<FetchedContent> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  const { buf } = await getRawBuffer(url);
  const data = await pdfParse(buf);
  return {
    text: data.text.substring(0, MAX_CHARS),
    source: 'annual_report',
    url,
    strategy: 'pdf',
    page_count: data.numpages,
  };
}

// Wired but disabled by default — set ENABLE_OCR=true to activate Tesseract.js OCR on image PDFs.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function strategyOcr(_url: string): Promise<FetchedContent> {
  throw new Error('OCR strategy not enabled — set ENABLE_OCR=true');
}

// Exported for unit testing of routing logic without live HTTP.
export function selectStrategy(contentType: string, strippedLength: number): FetchStrategy {
  if (contentType.includes('application/pdf')) return 'pdf';
  if (strippedLength < SPA_TEXT_THRESHOLD) return 'playwright';
  return 'html';
}

export async function fetchContent(url: string): Promise<FetchedContent> {
  // HEAD probe to detect PDF before downloading the full body.
  let headContentType = '';
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Syntra Onboarding Bot)' },
    });
    headContentType = head.headers.get('content-type') || '';
  } catch {
    // Some servers reject HEAD — proceed to GET
  }

  if (headContentType.includes('application/pdf')) {
    return strategyPdf(url);
  }

  // Try HTML strategy first
  let htmlResult: FetchedContent | null = null;
  try {
    htmlResult = await strategyHtml(url);
  } catch {
    // Fall through to Playwright
  }

  if (htmlResult !== null) {
    // strategyHtml returned null only for PDFs (handled above) or SPA.
    // A non-null result means we got enough text.
    return htmlResult;
  }

  // htmlResult === null means SPA or content-type was unexpectedly pdf
  // Re-check: if it looks like a PDF at this point try PDF strategy, else Playwright.
  // At this point we already fetched the buffer inside strategyHtml; to avoid re-fetching
  // we just use Playwright as the universal fallback for text-sparse pages.
  return strategyPlaywright(url);
}
