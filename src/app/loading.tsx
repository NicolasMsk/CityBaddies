export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#7b0a0a]/30 rounded-full animate-spin border-t-[#9b1515]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">✨</span>
          </div>
        </div>
        <p className="text-white/40 animate-pulse">Chargement des deals...</p>
      </div>
    </div>
  );
}
