# Amdavad Oven — Ahmedabad pizza ordering PWA

A static, installable demo storefront for an artisan-pizza launch concept. Intended initial areas: Naranpura and Navrangpura, Ahmedabad.

## What's included
- 23 sample products across vegetarian and non-vegetarian pizzas, sides, desserts and drinks
- Search, category filters, regular/large pizza sizes, cart and subtotal
- Checkout form with order-request handoff to a verified WhatsApp number
- Menu-aware local FAQ / recommendation helper (deterministic rules, not a hosted LLM)
- Share-link actions and responsive mobile/desktop styling
- PWA manifest, app icon and basic offline app-shell cache

## Free static hosting: GitHub Pages
1. Open this repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions** and save.
4. Open **Actions → Deploy Amdavad Oven to GitHub Pages**. Re-run the workflow if it has not started automatically.
5. When the workflow succeeds, GitHub displays the public Pages URL in the deployment/environment details. The expected URL for this repository is usually `https://saharshsrivastava01-hue.github.io/pizzaplay/`, but it is not live until GitHub confirms a successful deployment.

No build command is needed; the static files are served from the repository root. The deployment workflow is in `.github/workflows/deploy-pages.yml`.

## Configure before taking orders
1. Open the site and scroll to **Owner setup**.
2. Enter the verified business WhatsApp number as `91XXXXXXXXXX` (country code plus ten digits) and save.
3. Test an order request on your own phone.
4. Replace every sample price, product, ingredient, allergen note, store hour and service-area statement with information verified by the kitchen.
5. Arrange a real kitchen, packaging, fulfilment, customer support and order confirmation process.

## Important limitations
This is a front-end static MVP, not a production commerce backend:
- Cart and WhatsApp settings are stored in the visitor's browser.
- Orders are handed off to WhatsApp; no central order database or staff order dashboard exists.
- No customer accounts, secure admin authentication, inventory sync, delivery dispatch/live tracking, payment processing, refund workflow or real-time order status exists.
- The assistant uses the menu and a small local FAQ/rule set. It is not ChatGPT and does not contain ChatGPT's private model weights, hidden knowledge stores or all conversations. A genuine AI integration requires a model/API, server-side secret handling and a budget/hosting plan.
- “Viral” reach or revenue cannot be guaranteed by software.

Before public launch, configure a secure backend and authentication if central customer/order records are required; check applicable FSSAI registration/licensing and tax obligations; publish privacy, cancellation/refund and allergen information; and connect a compliant payment provider if online payments are required. Do not collect real customer data until suitable privacy and security controls are in place.
