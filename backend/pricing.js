'use strict';

const TOPPINGS = Object.freeze({
  extra_cheese: { label: 'Extra cheese', price: 30 },
  jalapeno: { label: 'Jalapeño', price: 30 },
  olives: { label: 'Olives', price: 30 },
  paneer: { label: 'Paneer', price: 40 }
});

function calculateCart(items, products) {
  const byId = new Map(products.map((p) => [Number(p.id), p]));
  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error('Each item quantity must be between 1 and 20.');
    }

    if (item.type === 'standard') {
      const product = byId.get(Number(item.productId));
      if (!product || !product.is_available) throw new Error('An item in your cart is unavailable. Please refresh the menu.');
      const isLarge = item.size === 'large';
      if (isLarge && !product.is_pizza) throw new Error('Only pizzas can be ordered in a large size.');
      const unit = Number(product.price_rupees) + (isLarge ? 100 : 0);
      const lineTotal = unit * quantity;
      lines.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: unit,
        lineTotal,
        variant: isLarge ? 'Large' : 'Regular',
        customisation: null
      });
      subtotal += lineTotal;
      continue;
    }

    if (item.type === 'custom') {
      const config = item.config || {};
      const base = byId.get(Number(config.baseProductId));
      const half = config.halfProductId ? byId.get(Number(config.halfProductId)) : null;
      if (!base || !base.is_available || !base.is_pizza) throw new Error('The selected base pizza is unavailable.');
      if (half && (!half.is_available || !half.is_pizza)) throw new Error('The second pizza flavour is unavailable.');
      if (half && Boolean(half.is_veg) !== Boolean(base.is_veg)) throw new Error('Half-and-half flavours must be in the same dietary category.');
      const size = config.size === 'large' ? 'large' : 'regular';
      const crust = config.crust || 'classic';
      if (!['classic', 'thin', 'cheese_burst'].includes(crust)) throw new Error('Invalid crust selection.');
      const toppings = Array.isArray(config.toppings) ? config.toppings : [];
      if (toppings.length > 4 || toppings.some((t) => !Object.prototype.hasOwnProperty.call(TOPPINGS, t))) {
        throw new Error('One or more toppings are not recognised.');
      }
      const toppingCost = toppings.reduce((sum, key) => sum + TOPPINGS[key].price, 0);
      const unit = Math.max(Number(base.price_rupees), half ? Number(half.price_rupees) : 0)
        + (half ? 35 : 0)
        + (size === 'large' ? 100 : 0)
        + (crust === 'cheese_burst' ? 80 : 0)
        + toppingCost;
      const names = [base.name, half && half.name].filter(Boolean);
      const customisation = {
        baseProductId: base.id,
        halfProductId: half ? half.id : null,
        crust,
        toppings: toppings.map((key) => TOPPINGS[key].label),
        notes: String(config.notes || '').slice(0, 180)
      };
      const lineTotal = unit * quantity;
      lines.push({
        productId: null,
        productName: 'Custom ' + (size === 'large' ? 'Large' : 'Regular') + ' · ' + names.join(' / '),
        quantity,
        unitPrice: unit,
        lineTotal,
        variant: size === 'large' ? 'Large' : 'Regular',
        customisation
      });
      subtotal += lineTotal;
      continue;
    }

    throw new Error('Unknown cart item type.');
  }

  return { lines, subtotal };
}

function calculateDiscount(code, subtotal, isFirstOrder, enabled) {
  if (!code) return 0;
  if (!enabled) throw new Error('Promotional codes are not enabled by the store yet.');
  const normalized = String(code).trim().toUpperCase();
  if (normalized === 'OVEN10' && subtotal >= 299) return Math.min(75, Math.round(subtotal * 0.10));
  if (normalized === 'FIRST50' && subtotal >= 499 && isFirstOrder) return 50;
  throw new Error('This promotion is not eligible for this order.');
}

module.exports = { calculateCart, calculateDiscount, TOPPINGS };