// Lightweight dynamic renderer using Alpine.js + Mermaid

window.appState = function appState() {
  return {
    db: null,
    erdText: '',
    sections: [
      'CATEGORIES',
      'BRANDS',
      'PRODUCTS',
      'PRODUCT_CATEGORIES',
      'USERS',
      'CUSTOMERS',
      'SELLERS',
      'PRODUCT_VARIANTS',
      'PRODUCT_IMAGES',
      'PRODUCT_ATTRIBUTES',
      'PRODUCT_ATTRIBUTE_VALUES',
      'PRODUCT_BASE_ATTRIBUTES',
      'PRODUCT_VARIANT_ATTRIBUTES',
      'INVENTORY',
      'ADDRESSES',
      'CUSTOMER_SHIPPING_ADDRESSES',
      'CUSTOMER_BILLING_ADDRESSES',
      'ORDERS',
      'ORDER_ITEMS',
      'ORDER_ITEM_PROMOTIONS',
      'PROMOTIONS',
      'PROMOTION_RULES',
      'PROMOTION_CONDITIONS',
      'PLATFORM_ADMINS',
      'CART_ITEMS',
      'CART_ITEM_DISCOUNTS'
    ],
    async init() {
      // Load sample data JSON
      const dataResp = await fetch('data/sample-data.json');
      this.db = await dataResp.json();

      // Load Mermaid ERD text and render
      const erdResp = await fetch('mermaid/marketplace-erd-updated.mermaid');
      this.erdText = await erdResp.text();

      if (window.mermaid) {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        const container = document.getElementById('erd-container');
        try {
          const { svg } = await mermaid.render('marketplaceERD', this.erdText);
          container.innerHTML = svg;
        } catch (e) {
          container.innerHTML = '<pre class="mermaid">' + this.escapeHtml(this.erdText) + '</pre>';
          mermaid.init(undefined, container.querySelectorAll('.mermaid'));
        }
      }

      // Enable highlight behavior for section links
      this.setupSectionLinks();
    },
    escapeHtml(str) {
      return str.replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
    },
    formatSection(name) {
      if (!this.db || !this.db[name]) return '[]';
      return JSON.stringify(this.db[name], null, 2);
    },
    // Helpers for left board rendering
    brandName(brandId) {
      const b = this.db.BRANDS.find(x => x.id === brandId);
      return b ? b.name : brandId;
    },
    productCategories(productId) {
      return this.db.PRODUCT_CATEGORIES.filter(pc => pc.product_id === productId).map(pc => pc.category_id);
    },
    categoryName(catId) {
      const c = this.db.CATEGORIES.find(x => x.id === catId);
      return c ? c.name : catId;
    },
    categoryPath(catId) {
      const map = Object.fromEntries(this.db.CATEGORIES.map(c => [c.id, c]));
      const parts = [];
      let cur = map[catId];
      while (cur) { parts.push(cur.name); cur = cur.parent_id ? map[cur.parent_id] : null; }
      return parts.reverse().join(' › ');
    },
    sellerName(sellerId) {
      const s = this.db.SELLERS.find(x => x.id === sellerId);
      return s ? s.name : sellerId;
    },
    productName(productId) {
      const p = this.db.PRODUCTS.find(x => x.id === productId);
      return p ? p.name : productId;
    },
    customerOrders(customerId) {
      return this.db.ORDERS.filter(o => o.customer_id === customerId);
    },
    orderItems(orderId) {
      return this.db.ORDER_ITEMS.filter(oi => oi.order_id === orderId);
    },
    variantById(variantId) {
      return this.db.PRODUCT_VARIANTS.find(v => v.id === variantId);
    },
    orderItemPromotions(orderItemId) {
      return (this.db.ORDER_ITEM_PROMOTIONS || []).filter(p => p.order_item_id === orderItemId);
    },
    promotionById(promotionId) {
      return (this.db.PROMOTIONS || []).find(p => p.id === promotionId);
    },
    formatOrderItemPromotion(p) {
      const name = p.promotion_snapshot?.name || this.promotionById(p.promotion_id)?.name || p.promotion_id;
      const amt = typeof p.discount_amount === 'number' ? p.discount_amount.toFixed(2) : null;
      return amt ? `${name} (−$${amt})` : name;
    },
    promotionRulesFor(promoId) {
      return this.db.PROMOTION_RULES ? this.db.PROMOTION_RULES.filter(r => r.promotion_id === promoId) : [];
    },
    promotionSummary(promo) {
      const rules = this.promotionRulesFor(promo.id);
      if (!rules.length) return promo.name;
      const r = rules[0];
      if (r.get_quantity && r.get_quantity > 0) {
        const v = this.db.PRODUCT_VARIANTS.find(v => v.id === r.buy_variant_id);
        const pName = v ? this.productName(v.product_id) : r.buy_variant_id;
        return `Buy ${r.buy_quantity} get ${r.get_quantity} free on ${pName}`;
      }
      if (r.discount_percentage && r.buy_category_id) {
        return `Buy at least ${r.buy_quantity} in ${this.categoryName(r.buy_category_id)}: ${r.discount_percentage}% off`;
      }
      return promo.name;
    },
    // Attributes helpers
    attributeValue(avId) {
      return (this.db.PRODUCT_ATTRIBUTE_VALUES || []).find(v => v.id === avId);
    },
    attributeNameFromValue(avId) {
      const av = this.attributeValue(avId); if (!av) return avId;
      const attr = (this.db.PRODUCT_ATTRIBUTES || []).find(a => a.id === av.attribute_id);
      return attr ? attr.name : avId;
    },
    baseAttributesForProduct(productId) {
      const pairs = (this.db.PRODUCT_BASE_ATTRIBUTES || []).filter(b => b.product_id === productId);
      return pairs.map(p => ({ name: this.attributeNameFromValue(p.attribute_value_id), value: (this.attributeValue(p.attribute_value_id) || {}).value }));
    },
    variantAttributesForVariant(variantId) {
      const pairs = (this.db.PRODUCT_VARIANT_ATTRIBUTES || []).filter(b => b.variant_id === variantId);
      return pairs.map(p => ({ name: this.attributeNameFromValue(p.attribute_value_id), value: (this.attributeValue(p.attribute_value_id) || {}).value }));
    },
    // Images helpers
    imagesForProduct(productId) {
      return (this.db.PRODUCT_IMAGES || []).filter(im => im.product_id === productId);
    },
    // Cart helpers
    cartIds() {
      return Array.from(new Set((this.db.CART_ITEMS || []).map(ci => ci.cart_id)));
    },
    cartItems(cartId) {
      return (this.db.CART_ITEMS || []).filter(ci => ci.cart_id === cartId);
    },
    cartDiscountsForItem(cartItemId) {
      return (this.db.CART_ITEM_DISCOUNTS || []).filter(d => d.cart_item_id === cartItemId);
    },
    setupSectionLinks() {
      document.querySelectorAll('a.section-link').forEach(a => {
        a.addEventListener('click', e => {
          const id = a.getAttribute('href').slice(1);
          const el = document.getElementById(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const pre = el.closest('pre') || el.parentElement;
            if (pre) {
              pre.classList.add('ring-2','ring-sky-400','ring-offset-2','ring-offset-slate-950','rounded');
              setTimeout(() => pre.classList.remove('ring-2','ring-sky-400','ring-offset-2','ring-offset-slate-950','rounded'), 1200);
            }
          }
        });
      });
    }
  };
};
