import { Product } from '../models/pos';

export const PRODUCT_TILE_COLORS = [
  '#D6D6DB',
  '#AA0D52',
  '#E00034',
  '#FF5B39',
  '#FF9F40',
  '#FFBC0A',
  '#B78A58',
  '#7A5A35',
  '#1E8B2D',
  '#00B82F',
  '#25C6A0',
  '#1F6BF2',
  '#3A8FE8',
  '#7D1ED8',
  '#D42DB7',
];

export function getProductTileLabel(product: Pick<Product, 'tileLabel' | 'name'>) {
  return product.tileLabel?.trim() || product.name?.trim() || 'New Item';
}

export function getProductTileInitials(
  product: Pick<Product, 'tileLabel' | 'name' | 'imagePlaceholder'>,
) {
  const source = product.tileLabel?.trim() || product.imagePlaceholder?.trim() || product.name?.trim() || 'PO';
  return source.slice(0, 2).toUpperCase();
}

export function getReadableTileTextColor(
  backgroundColor: string,
  darkText = '#111214',
  lightText = '#FFFFFF',
) {
  const normalized = backgroundColor.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map(value => `${value}${value}`)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return lightText;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 160 ? darkText : lightText;
}
