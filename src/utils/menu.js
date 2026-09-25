// Menu helpers: image resolution and on-the-fly nutrition values
// derived from price and stock.

import IMAGE_FILES from '../data/imageFiles.js';

// "Pasta Bolognese" -> "pasta-bolognese"
export function menuNameToSlug(menuName) {
  return String(menuName || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Resolve the image URL for a menu item: prefer assets/images/<slug>.<ext>,
// also accepting accidental double extensions like "<slug>.jpg.jpg".
export function getMenuImagePath(menuName, dbImageUrl) {
  const slug = menuNameToSlug(menuName);
  const filename = IMAGE_FILES[slug];
  if (filename) {
    return '/assets/images/' + filename;
  }
  if (dbImageUrl) {
    return dbImageUrl;
  }
  return 'https://via.placeholder.com/500x350?text=No+Image';
}

// Nutrition values:
//   calories = round(price * 8.5)
//   carbs  = (stock % 20) + 15
//   protein = (stock % 18) + 12
//   fat     = (stock % 14) + 8
export function getNutrition(item) {
  const price = Number(item.price) || 0;
  const stock = Number(item.stock) || 0;
  return {
    calories: Math.round(price * 8.5),
    carbs: (stock % 20) + 15,
    protein: (stock % 18) + 12,
    fat: (stock % 14) + 8,
  };
}