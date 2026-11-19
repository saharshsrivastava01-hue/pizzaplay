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


## New storefront upgrade (19 November 2026)
- Build-your-own pizza configurator: regular/large, crust choice, half-and-half (matching vegetarian category), extra toppings and kitchen notes
- Custom pizza items persist in the visitor's local cart and are included in the WhatsApp order request
- English / Gujarati / Hindi interface selector for key navigation, menu and checkout labels; menu/product detail translation still needs editorial review
- If the public WhatsApp number has not been configured, checkout now prepares a copyable/downloadable order-request draft instead of silently failing. The draft is **not sent** and does **not** create a server-side order.
- “Oven Future Guild · 2090” introduces the fictional Crustogenesis, FlavorFlux, OrderWeave, HearthOS, TrustForge, LocaleMorph, SignalSage and CloudNexus disciplines. The “10,000,000+ simulated design-years” wording is clearly fictional brand lore, not real experience or staffing.

## Operational boundary
The Render service is a static-site service. Browser local storage is per visitor and is not shared with restaurant staff. No secure owner dashboard, central database, payment processing, staff authentication, live stock, delivery dispatch or persistent order management is implemented by this static deployment. Do not accept online prepayment or treat a browser order draft as a confirmed sale.

## Ahmedabad launch and referral toolkit
- `launch.html` provides referral links and manually shareable WhatsApp, Facebook, Instagram and YouTube copy.
- `campaign.js` captures campaign/referral tags and logs anonymous page/share/cart/order events only after visitor opt-in.
- `admin.html` includes a protected marketing report and owner/manager store settings.
- Listing and paid-placement links are provided for public Ahmedabad channels; each publisher must approve the placement and provide its current rate card.
- Referral codes measure first-party site traffic and linked order requests. They do not scrape other sites, identify users, or guarantee reach.
- The global store WhatsApp number should be configured by an authenticated owner only after a real business number is provisioned and verified.
