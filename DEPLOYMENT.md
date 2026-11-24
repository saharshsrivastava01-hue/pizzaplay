# Amdavad Oven deployment

Static storefront hosted by the connected Render service.

- Main storefront: https://amdavad-oven.onrender.com
- 9D interactive pizza experience: /experience-9d.html
- 5D-inspired studio: /experience-5d.html

The 9D experience is a browser-side prototype. Three.js is loaded from a public CDN. Basket and analytics are session-local; checkout opens an email draft and does not process orders or payments.

Render is configured to auto-deploy commits from the `main` branch. Verify the latest deployment in the Render dashboard before announcing a release.
