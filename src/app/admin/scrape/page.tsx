'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, CheckCircle, AlertCircle, Package } from 'lucide-react';

interface ScrapingResult {
  merchant: string;
  scrapingResult: {
    success: boolean;
    products: Array<{
      name: string;
      currentPrice: number;
      discount: number;
    }>;
    errors: string[];
    duration: number;
  };
  imported: number;
  skipped: number;
  errors: string[];
}

interface ApiResponse {
  success: boolean;
  message: string;
  results: ScrapingResult[];
  summary: {
    totalImported: number;
    totalSkipped: number;
    totalErrors: number;
  };
  error?: string;
}

export default function ScrapingPage() {
  const [merchant, setMerchant] = useState<'decathlon' | 'amazon' | 'all'>('decathlon');
  const [searchQuery, setSearchQuery] = useState('fitness musculation');
  const [maxProducts, setMaxProducts] = useState(10);
  const [headless, setHeadless] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant,
          searchQuery,
          maxProducts,
          headless,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du scraping');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">🤖 Scraping Automatique</h1>
            <p className="text-gray-400">Importer des produits depuis Decathlon ou Amazon</p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Merchant */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Source
              </label>
              <select
                value={merchant}
                onChange={(e) => setMerchant(e.target.value as typeof merchant)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="decathlon" className="bg-gray-800">Decathlon</option>
                <option value="amazon" className="bg-gray-800">Amazon</option>
                <option value="all" className="bg-gray-800">Tous</option>
              </select>
            </div>

            {/* Max Products */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre max de produits
              </label>
              <input
                type="number"
                value={maxProducts}
                onChange={(e) => setMaxProducts(Number(e.target.value))}
                min={1}
                max={50}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Search Query */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recherche
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="fitness, musculation, haltère..."
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Headless */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={headless}
                  onChange={(e) => setHeadless(e.target.checked)}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-gray-300">
                  Mode headless (sans fenêtre navigateur)
                </span>
              </label>
            </div>
          </div>

          {/* Bouton Scrape */}
          <button
            onClick={handleScrape}
            disabled={loading || !searchQuery.trim()}
            className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scraping en cours...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Lancer le scraping
              </>
            )}
          </button>
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Erreur</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Résultats */}
        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="font-medium text-green-400">{result.message}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{result.summary.totalImported}</p>
                  <p className="text-sm text-gray-400">Importés</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{result.summary.totalSkipped}</p>
                  <p className="text-sm text-gray-400">Ignorés</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{result.summary.totalErrors}</p>
                  <p className="text-sm text-gray-400">Erreurs</p>
                </div>
              </div>
            </div>

            {/* Détail par merchant */}
            {result.results.map((r, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {r.merchant.charAt(0).toUpperCase() + r.merchant.slice(1)}
                  <span className="text-sm text-gray-400">
                    ({r.scrapingResult.duration}ms)
                  </span>
                </h3>

                {r.scrapingResult.products.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {r.scrapingResult.products.map((p, j) => (
                      <div 
                        key={j}
                        className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
                      >
                        <span className="text-gray-300 text-sm truncate flex-1 mr-2">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {p.currentPrice.toFixed(2)}€
                          </span>
                          {p.discount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
                              -{p.discount}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {r.errors.length > 0 && (
                  <div className="mt-3 text-sm text-red-400">
                    {r.errors.length} erreur(s): {r.errors[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        <div className="mt-8 bg-white/5 rounded-xl p-4">
          <h3 className="font-medium text-white mb-2">💡 Suggestions de recherche</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'haltère',
              'tapis yoga',
              'kettlebell',
              'barre musculation',
              'vélo elliptique',
              'rameur',
              'banc musculation',
              'corde à sauter',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setSearchQuery(suggestion)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm text-gray-300 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
