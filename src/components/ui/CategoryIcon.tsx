import {
  Sparkles,
  Droplets,
  Scissors,
  Crown,
  Palette,
  Gem,
  Smile,
  Heart,
  Flower2,
  Star,
  Sun,
  Moon,
  Circle,
  LucideIcon,
} from 'lucide-react';

// Mapping nom -> composant Lucide pour les catégories beauté
const iconMap: Record<string, LucideIcon> = {
  // Catégories principales
  Sparkles,      // Maquillage
  Droplets,      // Soins visage  
  Scissors,      // Cheveux
  Crown,         // Accessoires cheveux
  Palette,       // Teintures / Coloration
  Gem,           // Bijoux
  Smile,         // Blanchiment dentaire
  
  // Autres icônes beauté
  Heart,
  Flower2,
  Star,
  Sun,
  Moon,
  Circle,
  
  // Mapping pour les slugs
  'maquillage': Sparkles,
  'soins-visage': Droplets,
  'cheveux': Scissors,
  'accessoires-cheveux': Crown,
  'coloration': Palette,
  'teintures': Palette,
  'bijoux': Gem,
  'blanchiment-dentaire': Smile,
  'accessoires': Crown,
  'skincare': Droplets,
  'makeup': Sparkles,
};

interface CategoryIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function CategoryIcon({ name, className = '', size = 24 }: CategoryIconProps) {
  // Si c'est un emoji (commence par un caractère non-ASCII), l'afficher tel quel
  if (name && /^[\u{1F300}-\u{1F9FF}]/u.test(name)) {
    return <span className={className} style={{ fontSize: size }}>{name}</span>;
  }

  // Sinon, chercher l'icône Lucide
  const IconComponent = iconMap[name] || Sparkles;
  return <IconComponent className={className} size={size} />;
}
