'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user','assistant']),
    content: z.string().trim().min(1).max(1800)
  })).min(1).max(12)
});

module.exports = function createAiChatRouter(pool) {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'You are sending messages too quickly. Please wait a moment.' }
  });

  router.get('/api/ai/status', (_req,res) => {
    res.json({ available: Boolean(process.env.OPENAI_API_KEY), feature: 'Amdavad Oven AI Concierge' });
  });

  router.post('/api/ai/chat', limiter, async (req,res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'The AI assistant is not activated yet. The owner must add the OpenAI API key in the server settings.' });
    }
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Please send a shorter message.' });

    try {
      const menuResult = await pool.query(
        'SELECT name,category,is_veg,price_rupees,description,is_available FROM products ORDER BY id'
      );
      const configResult = await pool.query(
        "SELECT setting_key,setting_value FROM store_settings WHERE setting_key IN ('store_name','delivery_areas','delivery_enabled','pickup_enabled','opening_hours')"
      );
      const settings = Object.fromEntries(configResult.rows.map(row => [row.setting_key,row.setting_value]));
      const menu = menuResult.rows.map(item => ({
        name:item.name, category:item.category, vegetarian:item.is_veg,
        priceINR:Number(item.price_rupees), description:item.description,
        available:item.is_available
      }));
      const context = [
        'You are the Amdavad Oven AI Concierge, a helpful food-menu assistant for an Ahmedabad pizza concept.',
        'Use only the menu and store facts included below. Never invent stock, ingredients, allergens, prices, offers, opening hours, delivery coverage, preparation times, restaurant address, payment status or order status.',
        'If a fact is missing or marked unknown, say the kitchen must confirm it. The website is a concept storefront and the kitchen must accept every order request.',
        'You may recommend menu items, compare listed prices, explain listed descriptions, help users customise a pizza, and guide them to the menu or order-request flow.',
        'Do not claim an order is placed, accepted, paid, dispatched or delivered. Do not collect phone numbers, addresses, payment details or sensitive personal information in chat.',
        'For allergy or dietary safety, do not guarantee allergen-free food or absence of cross-contamination; ask the customer to confirm directly with the kitchen.',
        'Reply in the language the customer uses (English, Hindi or Gujarati). Keep answers concise, warm and practical.',
        'Store facts JSON: ' + JSON.stringify(settings),
        'Menu JSON: ' + JSON.stringify(menu)
      ].join('\n\n');

      const input = [
        { role: 'system', content: context },
        ...parsed.data.messages.map(message => ({ role: message.role, content: message.content }))
      ];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let upstream;
      try {
        upstream = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            input,
            max_output_tokens: 450,
            store: false
          })
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error('OpenAI request failed:', upstream.status, data.error && data.error.code);
        return res.status(502).json({ error: 'The AI assistant could not respond just now. Please try again.' });
      }
      const answer = typeof data.output_text === 'string' ? data.output_text.trim() :
        (data.output || []).flatMap(item => item.content || [])
          .filter(part => part.type === 'output_text' && part.text)
          .map(part => part.text).join('\n').trim();
      if (!answer) return res.status(502).json({ error: 'The AI assistant returned an empty reply. Please try again.' });
      res.json({ reply: answer, model: data.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini' });
    } catch (error) {
      console.error('AI concierge error:', error.name === 'AbortError' ? 'timeout' : error.message);
      res.status(502).json({ error: 'The AI assistant is temporarily unavailable. Please try again.' });
    }
  });
  return router;
};
