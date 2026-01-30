export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Hero Section Skeleton */}
        <div className="mb-16">
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse mb-4" />
          <div className="h-12 w-96 max-w-full bg-white/10 rounded animate-pulse mb-4" />
          <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
        </div>

        {/* Filters Skeleton */}
        <div className="flex gap-4 mb-12 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-24 bg-white/5 rounded animate-pulse shrink-0" />
          ))}
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div key={i} className="bg-[#050505] border border-white/5">
              {/* Image */}
              <div className="aspect-square bg-white/5 animate-pulse" />
              {/* Content */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                <div className="pt-3 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-2">
                    <div className="h-3 w-10 bg-white/5 rounded animate-pulse" />
                    <div className="h-6 w-16 bg-white/10 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-20 bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Subtle Loading Indicator */}
        <div className="fixed bottom-8 right-8 flex items-center gap-3 bg-black/80 backdrop-blur-sm border border-white/10 px-5 py-3">
          <div className="w-4 h-4 border-2 border-[#7b0a0a]/30 rounded-full animate-spin border-t-[#d4a855]" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Chargement...</span>
        </div>
      </div>
    </div>
  );
}
