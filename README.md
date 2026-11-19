# Amdavad Oven — branded pizza ordering PWA

A mobile-first static pizza storefront for the Ahmedabad launch concept. Initial target areas: Naranpura and Navrangpura. Static files are published from the repository root.

## Customer features
- 23 editable sample items: vegetarian/non-vegetarian pizzas, sides, desserts and drinks
- Search and category filters, regular/large pizza variants, cart and subtotal
- Promo-code demo: OVEN10 (10%, capped at ₹75, minimum subtotal ₹299) and FIRST50 (₹50 off, minimum subtotal ₹499)
- Cart upsells for garlic bread and cold coffee
- Checkout form and WhatsApp order-request handoff
- In-page customer support FAQ widget, with WhatsApp escalation when a store number is configured
- Menu-aware pizza recommendation guide (local rules; not a hosted ChatGPT model)
- Share-link actions, responsive layout and SVG brand wordmark
- PWA manifest, app icon and basic offline app-shell cache

## Public WhatsApp setup — required before taking orders
Edit `index.html` and find:
```js
const STORE_WHATSAPP_NUMBER="";
```
Set the value to the verified business number using country code plus ten digits, for example format `91XXXXXXXXXX`, with no plus sign or spaces. Commit and push the change. The Owner Setup local-storage field is only for that browser and does not configure the number for all visitors.

## Deployment
This repository is linked to the Render static site `amdavad-oven`. The site is configured to deploy from `main`. If automatic deployment is enabled, new commits are deployed on push; otherwise trigger deploy from Render Dashboard.

Live URL: https://amdavad-oven.onrender.com

## Important limitations
This is a static MVP, not a production commerce backend:
- Orders are handed off to WhatsApp; no central database, order dashboard, customer accounts or server-side order records.
- It does not process online payments, verify UPI payments, sync inventory, dispatch drivers or provide live order tracking.
- The FAQ widget is a curated local help assistant. It does not connect to ChatGPT or contain ChatGPT's hidden model weights, private knowledge stores or all conversations.
- Coupon logic is client-side demonstration logic, not a server-validated promotion engine. The owner must approve, amend or remove demo offers before promoting them.
- Sample prices, recipes, ingredients, allergens, hours, delivery estimates and service-area claims must be checked and updated by the kitchen. The store must confirm each request.
- A static website is browser-accessible over HTTPS but is not a native Android/iOS app. Users may be able to install it as a PWA in supported browsers.

Before accepting real customers, configure and verify the global store WhatsApp number; replace all sample menu and offer data; arrange a real kitchen, packaging, delivery and customer-care operation; confirm applicable FSSAI registration/licensing and tax obligations; publish privacy, cancellation/refund and allergen information; and add a secure backend, order database and compliant payment gateway when required.
