// Types partagés pour l'application

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  _count?: {
    products: number;
  };
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  website: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  brand?: string;
  category: Category;
  subcategory?: string;
  merchant: Merchant;
  productUrl: string;
  currentPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  priceHistory?: PriceHistory[];
  deals?: Deal[];
  priceStats?: PriceStats;
}

export interface PriceHistory {
  id: string;
  price: number;
  date: string;
}

export interface PriceStats {
  current: number;
  lowest: number;
  highest: number;
  average: number;
}

export interface Deal {
  id: string;
  product: Product;
  title: string;
  refinedTitle?: string;
  description?: string;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  volume?: string;
  volumeValue?: number;
  volumeUnit?: string;
  pricePerUnit?: number;
  brandTier?: number;
  score?: number;
  tags?: string;
  promoCode?: string;
  startDate: string;
  endDate?: string;
  isHot: boolean;
  isTrending?: boolean;
  isExpired: boolean;
  votes: number;
  views: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DealFilters {
  category?: string;
  merchant?: string;
  search?: string;
  sortBy?: 'createdAt' | 'discountPercent' | 'votes' | 'dealPrice';
  sortOrder?: 'asc' | 'desc';
  hotOnly?: boolean;
}
