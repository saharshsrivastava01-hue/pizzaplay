# Amdavad Oven — static ordering MVP

A single-page pizza ordering storefront for an Ahmedabad launch concept.

## Deploy
Publish the repository root (the folder containing `index.html`). No build command or package installation is needed.

## Features
- 23 editable sample menu items across pizzas, sides, dessert and drinks
- Search and menu filters
- Regular / Large pizza size selection
- Cart quantity controls and subtotal
- Checkout form and WhatsApp order-request handoff
- Lightweight menu recommendation helper
- Responsive layout and social-share metadata

## Configure before taking orders
1. Open the website in the same browser/device you will use to manage the demo.
2. At the bottom, enter the verified business WhatsApp number as `91XXXXXXXXXX` and save.
3. Test an order request on your own phone.
4. Replace all sample prices, ingredients, hours, contact and service-area details with verified business information.

## Limitations
This is a static MVP, not a production commerce backend. Cart and WhatsApp setting use browser local storage. Orders are sent to WhatsApp and are not stored in a server database. There is no secure admin login, inventory, real-time delivery tracking, payment processing, or external AI model. Recommendation uses simple local rules. The kitchen must confirm each request.

Before public launch, set up a secure database and authentication if order/admin records are required; verify the kitchen and delivery process; check applicable FSSAI registration/licensing and tax obligations; publish privacy, cancellation/refund and allergen information; and connect a compliant payment provider if online payment is required.
