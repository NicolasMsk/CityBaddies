import { Skeleton } from "@/components/ui/Skeleton"
import { ArrowLeft } from "lucide-react"

export default function DealDetailLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Breadcrumb Skeleton */}
        <nav className="mb-8">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-12 bg-white/5" />
            <span className="text-neutral-600">/</span>
            <Skeleton className="h-3 w-10 bg-white/5" />
            <span className="text-neutral-600">/</span>
            <Skeleton className="h-3 w-20 bg-white/5" />
          </div>
        </nav>

        {/* Back Link */}
        <div className="flex items-center gap-4 text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-600 mb-12">
          <ArrowLeft className="h-3 w-3" />
          <span>Retour à la collection</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-24">
          
          {/* Left Column: Image Skeleton */}
          <div className="lg:col-span-5">
            <div className="aspect-square bg-[#050505] border border-white/5 relative overflow-hidden">
              <Skeleton className="w-full h-full bg-white/5 rounded-none" />
              {/* Fake Discount Badge */}
              <Skeleton className="absolute top-0 left-0 w-20 h-10 rounded-none bg-white/10" />
            </div>
            
            {/* Share Section Skeleton */}
            <div className="mt-6 flex justify-between items-center border-t border-white/10 pt-6">
              <Skeleton className="h-3 w-28 bg-white/5" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-8 bg-white/5" />
                <Skeleton className="h-3 w-16 bg-white/5" />
              </div>
            </div>
          </div>

          {/* Right Column: Details Skeleton */}
          <div className="lg:col-span-7 flex flex-col">
            
            {/* Header Info */}
            <div className="mb-12 border-b border-white/10 pb-12">
              {/* Meta Tags */}
              <div className="flex items-center gap-6 mb-8">
                <Skeleton className="h-3 w-20 bg-[#d4a855]/20" />
                <span className="w-px h-3 bg-white/20" />
                <Skeleton className="h-3 w-24 bg-white/5" />
                <span className="w-px h-3 bg-white/20" />
                <Skeleton className="h-3 w-32 bg-white/5" />
              </div>

              {/* Title Skeleton - Large */}
              <div className="space-y-4 mb-6">
                <Skeleton className="h-12 w-full bg-white/10" />
                <Skeleton className="h-12 w-3/4 bg-white/10" />
              </div>

              {/* Description Skeleton */}
              <div className="space-y-3 mt-6">
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-5/6 bg-white/5" />
              </div>
            </div>

            {/* Price Section Skeleton */}
            <div className="mb-12 pb-12 border-b border-white/10">
              <div className="flex items-end justify-between">
                <div className="space-y-4">
                  {/* Original Price */}
                  <Skeleton className="h-4 w-20 bg-white/5" />
                  {/* Deal Price */}
                  <Skeleton className="h-16 w-36 bg-white/10" />
                  {/* Savings */}
                  <Skeleton className="h-4 w-32 bg-white/5" />
                </div>
                
                {/* Discount Badge */}
                <Skeleton className="h-20 w-20 rounded-full bg-[#7b0a0a]/20" />
              </div>
            </div>

            {/* Merchant & CTA Section */}
            <div className="mb-12 pb-12 border-b border-white/10">
              <div className="flex items-center gap-6 mb-8">
                {/* Merchant Logo */}
                <Skeleton className="h-12 w-12 rounded bg-white/10" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 bg-white/10" />
                  <Skeleton className="h-3 w-32 bg-white/5" />
                </div>
              </div>
              
              {/* CTA Button */}
              <Skeleton className="h-14 w-full bg-[#d4a855]/20" />
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center border border-white/5 py-6">
                  <Skeleton className="h-8 w-16 mx-auto bg-white/10 mb-2" />
                  <Skeleton className="h-3 w-20 mx-auto bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Price History Section */}
        <div className="mt-24 pt-12 border-t border-white/10">
          <Skeleton className="h-6 w-48 bg-white/10 mb-8" />
          <Skeleton className="h-64 w-full bg-white/5" />
        </div>

        {/* Similar Deals Section */}
        <div className="mt-24 pt-12 border-t border-white/10">
          <Skeleton className="h-6 w-40 bg-white/10 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#050505] border border-white/5">
                <Skeleton className="aspect-square w-full bg-white/5" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-3 w-16 bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-5 w-20 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subtle Loading Indicator */}
        <div className="fixed bottom-8 right-8 flex items-center gap-3 bg-black/80 backdrop-blur-sm border border-white/10 px-5 py-3">
          <div className="relative">
            <div className="w-4 h-4 border-2 border-[#7b0a0a]/30 rounded-full animate-spin border-t-[#d4a855]" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Chargement du deal...</span>
        </div>
      </div>
    </div>
  )
}
