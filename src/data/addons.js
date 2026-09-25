// Add-on options available per menu item.

const ADD_ONS_MAP = {
  'pasta bolognese': [
    { id: 'extra-parmesan', label: 'Extra Parmesan', price: 2.5 },
    { id: 'garlic-bread', label: 'Garlic Bread', price: 3.0 },
    { id: 'mushroom', label: 'Sauteed Mushroom', price: 2.0 },
  ],
  'spicy fried chicken': [
    { id: 'extra-rice', label: 'Extra Rice', price: 1.5 },
    { id: 'spicy-sauce', label: 'Spicy Sauce', price: 1.0 },
    { id: 'coleslaw', label: 'Coleslaw', price: 2.0 },
  ],
  'grilled steak': [
    { id: 'peppercorn-sauce', label: 'Peppercorn Sauce', price: 3.5 },
    { id: 'mashed-potato', label: 'Mashed Potato', price: 4.0 },
    { id: 'grilled-asparagus', label: 'Grilled Asparagus', price: 3.0 },
  ],
  'spaghetti carbonara': [
    { id: 'extra-bacon', label: 'Extra Bacon', price: 2.5 },
    { id: 'parmesan', label: 'Parmesan Topping', price: 2.0 },
    { id: 'toasted-bread', label: 'Toasted Bread', price: 2.5 },
  ],
  'fish and chips': [
    { id: 'tartar-sauce', label: 'Tartar Sauce', price: 1.0 },
    { id: 'extra-fries', label: 'Extra Fries', price: 2.0 },
    { id: 'lemon-butter', label: 'Lemon Butter', price: 1.5 },
  ],
  'tofu scramble': [
    { id: 'avocado', label: 'Avocado Slices', price: 2.5 },
    { id: 'wholegrain-toast', label: 'Wholegrain Toast', price: 2.0 },
    { id: 'vegan-cheese', label: 'Vegan Cheese', price: 2.0 },
  ],
  ratatouille: [
    { id: 'herb-rice', label: 'Herb Rice', price: 2.0 },
    { id: 'feta', label: 'Feta Crumble', price: 2.0 },
    { id: 'olive-tapenade', label: 'Olive Tapenade', price: 1.5 },
  ],
  'kimchi jigae': [
    { id: 'ramen-noodles', label: 'Ramen Noodles', price: 2.0 },
    { id: 'egg', label: 'Boiled Egg', price: 1.5 },
    { id: 'tofu-extra', label: 'Extra Tofu', price: 1.5 },
  ],
  'lemon mocktail': [
    { id: 'mint', label: 'Mint Leaves', price: 0.5 },
    { id: 'chia', label: 'Chia Seeds', price: 1.0 },
    { id: 'sparkling', label: 'Sparkling Upgrade', price: 1.5 },
  ],
  'chocolate mousse': [
    { id: 'whipped-cream', label: 'Whipped Cream', price: 1.0 },
    { id: 'almond', label: 'Roasted Almond', price: 1.5 },
    { id: 'berry', label: 'Berry Compote', price: 2.0 },
  ],
};

export function getAddOnsForProduct(productName) {
  const key = (productName || '').toLowerCase();
  return ADD_ONS_MAP[key] || [];
}