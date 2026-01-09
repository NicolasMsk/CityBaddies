import { chromium } from 'playwright';

async function extractEanFromNocibe(url: string) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        
        // Debug: afficher le titre de la page
        const title = await page.title();
        console.log('Titre de la page:', title);
        
        // Si c'est Access Denied, on est bloqué
        if (title.includes('Access Denied')) {
            console.log('❌ BLOQUÉ par Nocibé');
            return null;
        }
        
        // Attendre un peu pour le JS
        await page.waitForTimeout(3000);
        
        // Vérifier si __INITIAL_STATE__ existe
        const hasState = await page.evaluate(() => typeof (window as any).__INITIAL_STATE__ !== 'undefined');
        console.log('__INITIAL_STATE__ existe:', hasState);

        if (!hasState) {
            // Afficher un extrait du HTML pour debug
            const html = await page.content();
            console.log('Extrait HTML:', html.slice(0, 500));
            return null;
        }
        
        // Extraire l'EAN depuis __INITIAL_STATE__
        const ean = await page.evaluate(() => {
            const state = (window as any).__INITIAL_STATE__;

            // Recherche récursive de l'EAN
            const findEan = (obj: any): string | null => {
                if (!obj || typeof obj !== 'object') return null;
                if (obj.ean && typeof obj.ean === 'string' && /^\d{13}$/.test(obj.ean)) {
                    return obj.ean;
                }
                for (const key in obj) {
                    const result = findEan(obj[key]);
                    if (result) return result;
                }
                return null;
            };

            return findEan(state);
        });

        console.log(`✅ EAN extrait : ${ean || 'Non trouvé'}`);
        return ean;

    } catch (error) {
        console.error("Erreur :", error);
        return null;
    } finally {
        await browser.close();
    }
}

// Test avec ton lien Nocibé
extractEanFromNocibe("https://www.nocibe.fr/fr/p/1000722295?variant=740296");
