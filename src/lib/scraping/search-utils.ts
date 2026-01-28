/**
 * =============================================================================
 * SEARCH-UTILS.TS - Fonctions partagées pour la recherche de prix concurrents
 * =============================================================================
 */

import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Dossier pour stocker les screenshots
export const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Types exportés
export type CompetitorSite = 'sephora' | 'nocibe' | 'marionnaud';

export interface SiteConfig {
  domain: string;
  excludePatterns: string[];
  productPattern: string;
}

export interface CompetitorPriceResult {
  found: boolean;
  site: CompetitorSite;
  productUrl?: string;
  productName?: string;
  currentPrice?: number;
  originalPrice?: number;
  volume?: string;
  inStock?: boolean;
  error?: string;
  rawLLMResponse?: string;
}

export interface VisionAnalysisResult {
  currentPrice?: number;
  originalPrice?: number;
  volume?: string;
  productName?: string;
  inStock?: boolean;
  raw?: string;
}

// ============================================================================
// BROWSER SINGLETON
// ============================================================================

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
      ]
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ============================================================================
// PAGE STEALTH (Anti-détection)
// ============================================================================

export async function createStealthPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    geolocation: { latitude: 48.8566, longitude: 2.3522 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }
  });

  const page = await context.newPage();

  // Injecter des scripts pour masquer l'automatisation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    
    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__PW_inspect;
    
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
  });

  return page;
}

export async function closePage(page: Page): Promise<void> {
  const context = page.context();
  await page.close();
  await context.close();
}

// ============================================================================
// SERPER API (Recherche Google)
// ============================================================================

export async function findProductUrl(
  searchQuery: string, 
  siteConfig: SiteConfig
): Promise<string | null> {
  const searchVariants = generateSearchVariants(searchQuery);
  
  for (const variant of searchVariants) {
    const query = `${variant} site:${siteConfig.domain}`;
    console.log(`[SERPER] "${query}"`);
    
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: 'POST',
        headers: { 
          'X-API-KEY': SERPER_API_KEY, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ q: query, num: 10, gl: 'fr', hl: 'fr' })
      });
      
      if (!response.ok) {
        console.error(`[SERPER] HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      for (const result of (data.organic || [])) {
        const url = result.link || '';
        
        if (!url.includes(siteConfig.domain)) continue;
        
        const isExcluded = siteConfig.excludePatterns.some(pattern => url.includes(pattern));
        if (isExcluded) continue;
        
        const productPatternRegex = new RegExp(siteConfig.productPattern);
        if (!productPatternRegex.test(url)) continue;
        
        console.log(`[SERPER] URL trouvée: ${url}`);
        return url;
      }
      
    } catch (error) {
      console.error('[SERPER] Erreur:', error);
    }
  }
  
  console.log(`[SERPER] Aucune page produit trouvée`);
  return null;
}

function generateSearchVariants(query: string): string[] {
  const variants: string[] = [query];
  
  const simplified = query
    .replace(/[&+]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (simplified !== query) {
    variants.push(simplified);
  }
  
  const words = simplified.split(' ').filter(w => w.length > 2);
  if (words.length > 4) {
    variants.push(words.slice(0, 4).join(' '));
  }
  
  const genericWords = ['de', 'du', 'la', 'le', 'les', 'des', 'pour', 'aux', 'au', 'en', 'et', 'à'];
  const withoutGeneric = words.filter(w => !genericWords.includes(w.toLowerCase()));
  if (withoutGeneric.length >= 2 && withoutGeneric.join(' ') !== query) {
    variants.push(withoutGeneric.slice(0, 4).join(' '));
  }
  
  return Array.from(new Set(variants));
}

// ============================================================================
// VISION LLM (GPT-4o-mini)
// ============================================================================

export async function analyzeScreenshotWithVision(
  screenshot: Buffer,
  site: CompetitorSite,
  targetVolume?: string
): Promise<VisionAnalysisResult> {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  const base64Image = screenshot.toString('base64');
  
  const volumeInstruction = targetVolume 
    ? `\n⚠️ TRÈS IMPORTANT: Je cherche EXACTEMENT le contenant ${targetVolume}.
Sur cette page, il y a probablement PLUSIEURS contenances avec leurs prix respectifs.
Tu DOIS trouver la ligne qui correspond à ${targetVolume} et retourner SON prix.`
    : '';
  
  const prompt = `Analyse cette capture d'écran d'une page produit ${site}.${volumeInstruction}

Extrais les informations suivantes (en JSON) :
- currentPrice: le prix en euros (nombre, ex: 94.00)
- originalPrice: le prix barré/original si visible (nombre ou null)
- volume: "${targetVolume || 'la contenance visible'}"
- productName: le nom du produit
- inStock: true si disponible, false sinon

Réponds UNIQUEMENT avec le JSON.
Exemple: {"currentPrice": 94.00, "originalPrice": null, "volume": "50ml", "productName": "J'adore", "inStock": true}`;

  try {
    console.log(`[VISION] Analyse en cours...`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'low' } }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.1
    });
    
    const content = response.choices[0]?.message?.content || '';
    console.log(`[VISION] Réponse: ${content}`);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { raw: content };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      currentPrice: typeof parsed.currentPrice === 'number' ? parsed.currentPrice : undefined,
      originalPrice: typeof parsed.originalPrice === 'number' ? parsed.originalPrice : undefined,
      volume: parsed.volume || undefined,
      productName: parsed.productName || undefined,
      inStock: parsed.inStock ?? true,
      raw: content
    };
    
  } catch (error) {
    console.error('[VISION] Erreur:', error);
    return { raw: error instanceof Error ? error.message : 'Erreur' };
  }
}

// ============================================================================
// UTILS
// ============================================================================

export function saveScreenshot(screenshot: Buffer, site: CompetitorSite): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${site}_${timestamp}.jpg`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  fs.writeFileSync(filepath, screenshot);
  console.log(`[SCREENSHOT] Sauvegardé: ${filepath}`);
  return filepath;
}

export async function closeCookiePopup(page: Page): Promise<void> {
  const cookieSelectors = [
    '[id*="cookie"] button[id*="accept"]',
    '[class*="cookie"] button[class*="accept"]',
    '[data-testid*="cookie"] button',
    '#onetrust-accept-btn-handler',
    '.didomi-continue-without-agreeing',
    '#footer_tc_privacy_button_2',
    'button:has-text("Accepter")',
    'button:has-text("Tout accepter")',
  ];
  
  for (const selector of cookieSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      // Pas de popup
    }
  }
}

export async function simulateHumanBehavior(page: Page): Promise<void> {
  await page.waitForTimeout(500 + Math.random() * 500);
  await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
  await page.waitForTimeout(300);
  await page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 200);
}
