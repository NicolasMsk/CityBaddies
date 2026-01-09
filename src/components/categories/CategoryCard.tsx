import Link from 'next/link';
import Image from 'next/image';
import { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
}

// Map des slugs vers les noms de fichiers d'images
const categoryImages: Record<string, string> = {
  'maquillage': '/images/maquillage.png',
  'soins-visage': '/images/soins-visage.png',
  'cheveux': '/images/cheveux.png',
  'bijoux': '/images/bijoux.png',
  'ongles': '/images/ongles.png',
  'parfums': '/images/parfum.png',
  'blanchiment-dentaire': '/images/blanchiment-dentaire.png',
  'accessoires': '/images/accessoires.png',
};

export default function CategoryCard({ category }: CategoryCardProps) {
  const imageUrl = categoryImages[category.slug] || '/images/maquillage.png';

  return (
    <Link
      href={`/deals?category=${category.slug}`}
      className="group relative overflow-hidden rounded-2xl aspect-[4/5] border border-white/5 hover:border-[#7b0a0a]/40 transition-all duration-300 card-premium"
    >
      {/* Background Image */}
      <Image
        src={imageUrl}
        alt={category.name}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover group-hover:scale-110 transition-transform duration-500"
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-[#7b0a0a]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        {/* Name */}
        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#ff6b6b] transition-colors">
          {category.name}
        </h3>

        {/* Count - Affiche le nombre de deals, pas de produits */}
        <p className="text-sm text-white/60">
          {(category._count as any)?.deals || (category._count as any)?.products || 0} deals
        </p>
      </div>

      {/* Arrow */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
        <span className="text-white text-2xl">→</span>
      </div>
    </Link>
  );
}
