'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { randomUUID, randomBytes, timingSafeEqual } = require('node:crypto');
const { calculateCart, calculateDiscount } = require('./pricing');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || '';
const BOOTSTRAP_KEY = process.env.BOOTSTRAP_KEY || '';
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || 'https://amdavad-oven.onrender.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be a generated secret of at least 32 characters.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not permitted by CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Bootstrap-Key'],
  maxAge: 600
}));
app.use(express.json({ limit: '64kb' }));

const generalLimiter = rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 10 * 60000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
app.use(generalLimiter);

const seedProducts = [
  [1,'classic-margherita','Classic Margherita','Classic',true,249,'Tomato, mozzarella, basil and olive oil.','🍅',true],
  [2,'double-cheese-margherita','Double Cheese Margherita','Classic',true,299,'Tomato sauce and a generous mozzarella finish.','🧀',true],
  [3,'farmhouse-garden','Farmhouse Garden','Veg',true,329,'Bell pepper, onion, mushroom, tomato and corn.','🫑',true],
  [4,'paneer-tikka','Paneer Tikka','Signature',true,369,'Tandoori paneer, peppers, onion and smoky tikka sauce.','🧀',true],
  [5,'chilli-garlic-heat','Chilli Garlic Heat','Signature',true,349,'Roasted garlic, chilli, jalapeño and mozzarella.','🌶️',true],
  [6,'four-cheese','Four Cheese','Premium',true,399,'A rich blend of four cheeses and herbs.','🧀',true],
  [7,'corn-cheese','Corn & Cheese','Classic',true,279,'Sweet corn, mozzarella and house seasoning.','🌽',true],
  [8,'mushroom-truffle-style','Mushroom Truffle Style','Premium',true,429,'Mushrooms, creamy garlic sauce and herb oil.','🍄',true],
  [9,'pesto-garden','Pesto Garden','Premium',true,399,'Basil pesto, cherry tomato, mozzarella and olives.','🌿',true],
  [10,'jalapeno-olive','Jalapeño & Olive','Veg',true,329,'Jalapeño, black olives, onion and mozzarella.','🫒',true],
  [11,'mexican-fiesta','Mexican Fiesta','Signature',true,369,'Spiced beans, capsicum, onion, corn and salsa.','🌮',true],
  [12,'peri-peri-paneer','Peri Peri Paneer','Signature',true,389,'Peri peri paneer, peppers, onion and chilli flakes.','🔥',true],
  [13,'bbq-chicken','BBQ Chicken','Non-Veg',false,429,'Barbecue chicken, onion, mozzarella and smoky sauce.','🍗',true],
  [14,'chicken-tikka','Chicken Tikka','Non-Veg',false,449,'Tandoori chicken tikka, peppers and mint drizzle.','🍗',true],
  [15,'chicken-pepperoni-style','Chicken Pepperoni Style','Non-Veg',false,469,'Chicken pepperoni-style topping, mozzarella and oregano.','🍕',true],
  [16,'spicy-chicken-feast','Spicy Chicken Feast','Non-Veg',false,459,'Spiced chicken, jalapeño, onion and chilli sauce.','🌶️',true],
  [17,'garlic-bread','Garlic Bread','Sides',true,149,'Toasted garlic bread with herbs.','🥖',false],
  [18,'cheesy-garlic-bread','Cheesy Garlic Bread','Sides',true,199,'Garlic bread filled with mozzarella.','🧄',false],
  [19,'loaded-potato-wedges','Loaded Potato Wedges','Sides',true,179,'Crispy seasoned potato wedges with dip.','🍟',false],
  [20,'chocolate-brownie','Chocolate Brownie','Desserts',true,159,'Chocolate brownie dessert.','🍫',false],
  [21,'tiramisu-cup','Tiramisu Cup','Desserts',true,199,'Coffee-flavoured layered dessert cup.','☕',false],
  [22,'cold-coffee','Cold Coffee','Drinks',true,129,'Chilled coffee drink.','🥤',false],
  [23,'lemon-mint-cooler','Lemon Mint Cooler','Drinks',true,119,'Refreshing lemon and mint cooler.','🍋',false]
];

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      is_veg BOOLEAN NOT NULL DEFAULT TRUE,
      price_rupees INTEGER NOT NULL CHECK (price_rupees >= 0),
      description TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🍕',
      is_pizza BOOLEAN NOT NULL DEFAULT FALSE,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      public_token UUID UNIQUE NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      fulfilment TEXT NOT NULL,
      payment_preference TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      coupon_code TEXT,
      subtotal_rupees INTEGER NOT NULL,
      discount_rupees INTEGER NOT NULL DEFAULT 0,
      total_rupees INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      status TEXT NOT NULL DEFAULT 'received',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_rupees INTEGER NOT NULL,
      line_total_rupees INTEGER NOT NULL,
      variant TEXT,
      customisation JSONB
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner','manager','kitchen','support')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGSERIAL PRIMARY KEY,
      ticket_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      order_token UUID,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS marketing_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'direct',
      campaign TEXT NOT NULL DEFAULT '',
      referral_code TEXT,
      page_path TEXT NOT NULL DEFAULT '/',
      item_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_marketing_events_created ON marketing_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_marketing_events_referral ON marketing_events(referral_code);
    CREATE TABLE IF NOT EXISTS community_signups (
      id BIGSERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      neighbourhood TEXT NOT NULL,
      interest_type TEXT NOT NULL,
      referral_code TEXT,
      contact_consent BOOLEAN NOT NULL DEFAULT FALSE CHECK (contact_consent=TRUE),
      consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS community_votes (
      id BIGSERIAL PRIMARY KEY,
      poll_key TEXT NOT NULL,
      voter_token UUID NOT NULL,
      choice TEXT NOT NULL,
      neighbourhood TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(poll_key,voter_token)
    );
    CREATE INDEX IF NOT EXISTS idx_community_signups_created ON community_signups(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_community_votes_poll ON community_votes(poll_key,created_at DESC);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      admin_user_id BIGINT REFERENCES admin_users(id),
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status, created_at DESC);
  `);

  const defaultSettings = {
    store_name: 'AMDAVAD OVEN',
    whatsapp_number: '',
    opening_hours: {},
    delivery_areas: [],
    delivery_enabled: false,
    pickup_enabled: true,
    promotions_enabled: false,
    currency: 'INR',
    time_zone: 'Asia/Kolkata'
  };
  for (const [key,value] of Object.entries(defaultSettings)) {
    await pool.query(
      'INSERT INTO store_settings (setting_key,setting_value) VALUES ($1,$2) ON CONFLICT (setting_key) DO NOTHING',
      [key,JSON.stringify(value)]
    );
  }

  for (const p of seedProducts) {
    await pool.query(
      'INSERT INTO products (id,slug,name,category,is_veg,price_rupees,description,emoji,is_pizza) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING',
      p
    );
  }
}

const OrderSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
  area: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(500),
  fulfilment: z.enum(['Delivery','Pickup']),
  paymentPreference: z.enum(['cash_on_delivery','upi_manual']),
  notes: z.string().max(300).optional().default(''),
  couponCode: z.string().max(20).optional().default(''),
  referralCode: z.string().regex(/^[A-Z0-9]{6,12}$/).optional(),
  items: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('standard'), productId: z.number().int(), size: z.enum(['regular','large']), quantity: z.number().int().min(1).max(20) }),
    z.object({ type: z.literal('custom'), config: z.object({
      baseProductId: z.number().int(),
      halfProductId: z.number().int().nullable().optional(),
      size: z.enum(['regular','large']),
      crust: z.enum(['classic','thin','cheese_burst']),
      toppings: z.array(z.enum(['extra_cheese','jalapeno','olives','paneer'])).max(4),
      notes: z.string().max(180).optional().default('')
    }), quantity: z.number().int().min(1).max(20) })
  ])).min(1).max(30)
});

const SupportSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
  message: z.string().trim().min(8).max(1000),
  orderToken: z.string().uuid().optional()
});

function asyncRoute(fn) { return (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next); }
function bootstrapKeyMatches(provided) {
  if (!BOOTSTRAP_KEY || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(BOOTSTRAP_KEY);
  return a.length === b.length && timingSafeEqual(a,b);
}
function requireAuth(req,res,next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
function requireRoles(...roles) {
  return (req,res,next) => roles.includes(req.admin.role) ? next() : res.status(403).json({ error: 'Your account cannot perform this action.' });
}
async function audit(adminId,eventType,entityType,entityId,details={}) {
  await pool.query(
    'INSERT INTO audit_logs (admin_user_id,event_type,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5)',
    [adminId,eventType,entityType,String(entityId),JSON.stringify(details)]
  );
}

app.get('/healthz', asyncRoute(async (_req,res) => {
  await pool.query('SELECT 1');
  res.json({ ok:true, service:'amdavad-oven-api', database:'connected', time:new Date().toISOString() });
}));

app.get('/api/storefront-config', asyncRoute(async (_req,res) => {
  const result = await pool.query('SELECT setting_key,setting_value FROM store_settings');
  const values = Object.fromEntries(result.rows.map(r => [r.setting_key,r.setting_value]));
  res.json({
    storeName: values.store_name || 'AMDAVAD OVEN',
    whatsappNumber: values.whatsapp_number || '',
    openingHours: values.opening_hours || {},
    deliveryAreas: values.delivery_areas || [],
    deliveryEnabled: values.delivery_enabled === true,
    pickupEnabled: values.pickup_enabled !== false,
    promotionsEnabled: values.promotions_enabled === true,
    currency: values.currency || 'INR',
    timeZone: values.time_zone || 'Asia/Kolkata'
  });
}));

app.get('/api/menu', asyncRoute(async (_req,res) => {
  const result = await pool.query(
    'SELECT id,name,category,is_veg,price_rupees,description,emoji,is_pizza,is_available FROM products ORDER BY id'
  );
  res.json({ products:result.rows });
}));

app.post('/api/orders', orderLimiter, asyncRoute(async (req,res) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Please check your order details.', details:parsed.error.issues.map(i=>({path:i.path,message:i.message})) });
  const input = parsed.data;
  const idempotencyKey = String(req.get('idempotency-key') || randomUUID()).slice(0,120);
  const prior = await pool.query('SELECT order_number,public_token,status,total_rupees FROM orders WHERE idempotency_key=$1',[idempotencyKey]);
  if (prior.rowCount) return res.status(200).json({ ok:true, duplicate:true, order:prior.rows[0] });

  const productIds = [];
  for (const item of input.items) {
    if (item.type === 'standard') productIds.push(item.productId);
    else {
      productIds.push(item.config.baseProductId);
      if (item.config.halfProductId) productIds.push(item.config.halfProductId);
    }
  }
  const productsResult = await pool.query('SELECT * FROM products WHERE id=ANY($1::int[])',[Array.from(new Set(productIds))]);
  let calculated;
  try { calculated = calculateCart(input.items,productsResult.rows); }
  catch (err) { return res.status(400).json({ error:err.message }); }
  const priorCount = await pool.query('SELECT COUNT(*)::int AS count FROM orders WHERE phone=$1',[input.phone]);
  let discount;
  try {
    discount = calculateDiscount(input.couponCode,calculated.subtotal,Number(priorCount.rows[0].count)===0,process.env.PROMOTIONS_ENABLED==='true');
  } catch (err) { return res.status(400).json({ error:err.message }); }
  const total = calculated.subtotal-discount;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderNumber = 'AO-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + randomBytes(3).toString('hex').toUpperCase();
    const publicToken = randomUUID();
    const inserted = await client.query(
      'INSERT INTO orders (order_number,public_token,idempotency_key,customer_name,phone,area,address,fulfilment,payment_preference,notes,coupon_code,subtotal_rupees,discount_rupees,total_rupees,referral_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,order_number,public_token,status,total_rupees,payment_status,created_at',
      [orderNumber,publicToken,idempotencyKey,input.customerName,input.phone,input.area,input.address,input.fulfilment,input.paymentPreference,input.notes,input.couponCode||null,calculated.subtotal,discount,total,input.referralCode||null]
    );
    const order = inserted.rows[0];
    for (const line of calculated.lines) {
      await client.query(
        'INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price_rupees,line_total_rupees,variant,customisation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [order.id,line.productId,line.productName,line.quantity,line.unitPrice,line.lineTotal,line.variant,line.customisation?JSON.stringify(line.customisation):null]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ok:true, order });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const duplicate = await pool.query('SELECT order_number,public_token,status,total_rupees FROM orders WHERE idempotency_key=$1',[idempotencyKey]);
      if (duplicate.rowCount) return res.status(200).json({ ok:true, duplicate:true, order:duplicate.rows[0] });
    }
    throw err;
  } finally { client.release(); }
}));

app.get('/api/orders/track/:token', asyncRoute(async (req,res) => {
  if (!z.string().uuid().safeParse(req.params.token).success) return res.status(400).json({error:'Invalid tracking link.'});
  const result = await pool.query(
    'SELECT o.order_number,o.status,o.payment_status,o.fulfilment,o.total_rupees,o.created_at,o.updated_at, COALESCE(json_agg(json_build_object(\'name\',i.product_name,\'quantity\',i.quantity,\'variant\',i.variant) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL),\'[]\') AS items FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE o.public_token=$1 GROUP BY o.id',
    [req.params.token]
  );
  if (!result.rowCount) return res.status(404).json({error:'Order not found.'});
  res.json({order:result.rows[0]});
}));

const MarketingEventSchema = z.object({
  eventType:z.enum(['page_view','menu_search','add_to_cart','share_click','referral_visit','checkout_started','order_saved','support_opened']),
  source:z.enum(['direct','instagram','whatsapp','facebook','youtube','google','other']).default('direct'),
  campaign:z.string().max(80).optional().default(''),
  referralCode:z.string().regex(/^[A-Z0-9]{6,12}$/).optional(),
  pagePath:z.string().max(180).optional().default('/'),
  itemId:z.number().int().positive().optional()
});
app.post('/api/marketing/events',orderLimiter,asyncRoute(async (req,res)=>{
  const parsed=MarketingEventSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid campaign event.'});
  const x=parsed.data;
  await pool.query(
    'INSERT INTO marketing_events (event_type,source,campaign,referral_code,page_path,item_id) VALUES ($1,$2,$3,$4,$5,$6)',
    [x.eventType,x.source,x.campaign,x.referralCode||null,x.pagePath,x.itemId||null]
  );
  res.status(202).json({ok:true});
}));

const CommunityJoinSchema=z.object({
  customerName:z.string().trim().min(2).max(80),
  phone:z.string().regex(/^[6-9][0-9]{9}$/),
  neighbourhood:z.enum(['Naranpura','Navrangpura','CG Road','Vastrapur','Bodakdev','Satellite','Prahlad Nagar','Maninagar','Bopal','Chandkheda','Other']),
  interestType:z.enum(['early_access','food_creator','office_group','community_host']),
  referralCode:z.string().regex(/^[A-Z0-9]{6,12}$/).optional(),
  contactConsent:z.literal(true)
});
app.post('/api/community/join',orderLimiter,asyncRoute(async (req,res)=>{
  const parsed=CommunityJoinSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Please check the details and explicitly agree to receive launch updates.'});
  const x=parsed.data;
  const result=await pool.query(
    `INSERT INTO community_signups
      (customer_name,phone,neighbourhood,interest_type,referral_code,contact_consent,consented_at)
     VALUES ($1,$2,$3,$4,$5,TRUE,NOW())
     ON CONFLICT (phone) DO UPDATE SET
      customer_name=EXCLUDED.customer_name,
      neighbourhood=EXCLUDED.neighbourhood,
      interest_type=EXCLUDED.interest_type,
      referral_code=COALESCE(EXCLUDED.referral_code,community_signups.referral_code),
      contact_consent=TRUE,consented_at=NOW(),updated_at=NOW()
     RETURNING id,neighbourhood,interest_type,created_at`,
    [x.customerName,x.phone,x.neighbourhood,x.interestType,x.referralCode||null]
  );
  res.status(201).json({ok:true,signup:result.rows[0],message:'You are on the Ahmedabad launch list. No automated message has been sent.'});
}));

const CommunityVoteSchema=z.object({
  voterToken:z.string().uuid(),
  pollKey:z.literal('first-pizza-wave-2026'),
  choice:z.enum(['paneer_tikka','classic_margherita','four_cheese','peri_peri_paneer','chicken_tikka']),
  neighbourhood:z.enum(['Naranpura','Navrangpura','CG Road','Vastrapur','Bodakdev','Satellite','Prahlad Nagar','Maninagar','Bopal','Chandkheda','Other'])
});
app.post('/api/community/vote',orderLimiter,asyncRoute(async (req,res)=>{
  const parsed=CommunityVoteSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Choose one pizza and neighbourhood.'});
  const x=parsed.data;
  const result=await pool.query(
    'INSERT INTO community_votes (poll_key,voter_token,choice,neighbourhood) VALUES ($1,$2,$3,$4) ON CONFLICT (poll_key,voter_token) DO NOTHING RETURNING id',
    [x.pollKey,x.voterToken,x.choice,x.neighbourhood]
  );
  if(!result.rowCount)return res.status(409).json({error:'This browser has already submitted a vote in this poll.'});
  res.status(201).json({ok:true,message:'Vote recorded. This is a preference poll, not a promise that an item will launch.'});
}));
app.get('/api/community/poll',asyncRoute(async (_req,res)=>{
  const [totals,areas]=await Promise.all([
    pool.query(`SELECT choice,COUNT(*)::int AS votes FROM community_votes WHERE poll_key='first-pizza-wave-2026' GROUP BY choice ORDER BY votes DESC,choice`),
    pool.query(`SELECT neighbourhood,COUNT(*)::int AS votes FROM community_votes WHERE poll_key='first-pizza-wave-2026' GROUP BY neighbourhood ORDER BY votes DESC,neighbourhood`)
  ]);
  const total=totals.rows.reduce((n,r)=>n+Number(r.votes),0);
  res.json({pollKey:'first-pizza-wave-2026',totalSubmittedVotes:total,choices:totals.rows,neighbourhoods:areas.rows,note:'Submitted browser votes, not a verified count of unique Ahmedabad residents.'});
}));
app.post('/api/support', orderLimiter, asyncRoute(async (req,res) => {
  const parsed = SupportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'Please check the support request details.'});
  const x = parsed.data;
  const ticketCode = 'AO-S-' + randomBytes(3).toString('hex').toUpperCase();
  const result = await pool.query(
    'INSERT INTO support_tickets (ticket_code,customer_name,phone,order_token,message) VALUES ($1,$2,$3,$4,$5) RETURNING ticket_code,status,created_at',
    [ticketCode,x.customerName,x.phone,x.orderToken||null,x.message]
  );
  res.status(201).json({ok:true,ticket:result.rows[0]});
}));

app.post('/api/admin/bootstrap', authLimiter, asyncRoute(async (req,res) => {
  if (!bootstrapKeyMatches(req.get('x-bootstrap-key') || req.body.setupKey)) return res.status(403).json({error:'Invalid setup key.'});
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM admin_users');
  if (Number(count.rows[0].count)>0) return res.status(409).json({error:'Owner setup is already complete. Use the login form.'});
  const schema = z.object({email:z.string().email().max(200),password:z.string().min(12).max(100)});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'Use a valid email and a password of at least 12 characters.'});
  const hash = await bcrypt.hash(parsed.data.password,12);
  const result = await pool.query(
    'INSERT INTO admin_users (email,password_hash,role) VALUES ($1,$2,\'owner\') RETURNING id,email,role',
    [parsed.data.email.toLowerCase(),hash]
  );
  await audit(result.rows[0].id,'owner_bootstrap','admin_user',result.rows[0].id);
  res.status(201).json({ok:true,admin:result.rows[0],message:'Owner account created. Sign in to manage the store.'});
}));

app.post('/api/admin/login', authLimiter, asyncRoute(async (req,res) => {
  const parsed = z.object({email:z.string().email().max(200),password:z.string().min(1).max(100)}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'Enter a valid email and password.'});
  const result = await pool.query('SELECT id,email,password_hash,role,is_active FROM admin_users WHERE email=$1',[parsed.data.email.toLowerCase()]);
  if (!result.rowCount || !result.rows[0].is_active || !(await bcrypt.compare(parsed.data.password,result.rows[0].password_hash))) {
    return res.status(401).json({error:'Email or password is incorrect.'});
  }
  const user=result.rows[0];
  const token=jwt.sign({sub:String(user.id),email:user.email,role:user.role},JWT_SECRET,{expiresIn:'8h',issuer:'amdavad-oven-api',audience:'amdavad-oven-admin'});
  await audit(user.id,'admin_login','admin_user',user.id);
  res.json({token,admin:{email:user.email,role:user.role}});
}));

app.post('/api/admin/staff',requireAuth,requireRoles('owner'),asyncRoute(async (req,res)=>{
  const parsed=z.object({
    email:z.string().email().max(200),
    password:z.string().min(12).max(100),
    role:z.enum(['manager','kitchen','support'])
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Use a valid email, a 12+ character password and a supported staff role.'});
  const hash=await bcrypt.hash(parsed.data.password,12);
  try{
    const created=await pool.query(
      'INSERT INTO admin_users (email,password_hash,role) VALUES ($1,$2,$3) RETURNING id,email,role,is_active,created_at',
      [parsed.data.email.toLowerCase(),hash,parsed.data.role]
    );
    await audit(req.admin.sub,'staff_created','admin_user',created.rows[0].id,{email:created.rows[0].email,role:created.rows[0].role});
    res.status(201).json({staff:created.rows[0]});
  }catch(err){
    if(err.code==='23505')return res.status(409).json({error:'An account already exists with that email.'});
    throw err;
  }
}));
app.get('/api/admin/staff',requireAuth,requireRoles('owner','manager'),asyncRoute(async (_req,res)=>{
  const result=await pool.query('SELECT id,email,role,is_active,created_at FROM admin_users ORDER BY created_at');
  res.json({staff:result.rows});
}));

app.get('/api/admin/me',requireAuth,asyncRoute(async (req,res)=>{
  const r=await pool.query('SELECT id,email,role FROM admin_users WHERE id=$1 AND is_active=TRUE',[req.admin.sub]);
  if(!r.rowCount)return res.status(401).json({error:'Admin account unavailable.'});
  res.json({admin:r.rows[0]});
}));

app.get('/api/admin/settings',requireAuth,requireRoles('owner','manager'),asyncRoute(async (_req,res)=>{
  const result = await pool.query('SELECT setting_key,setting_value,updated_at FROM store_settings ORDER BY setting_key');
  res.json({settings:Object.fromEntries(result.rows.map(r=>[r.setting_key,r.setting_value]))});
}));
app.patch('/api/admin/settings',requireAuth,requireRoles('owner','manager'),asyncRoute(async (req,res)=>{
  const schema = z.object({
    store_name:z.string().trim().min(2).max(80).optional(),
    whatsapp_number:z.string().regex(/^(|91[6-9][0-9]{9})$/).optional(),
    opening_hours:z.record(z.string().max(100)).optional(),
    delivery_areas:z.array(z.string().trim().min(2).max(80)).max(30).optional(),
    delivery_enabled:z.boolean().optional(),
    pickup_enabled:z.boolean().optional(),
    promotions_enabled:z.boolean().optional()
  }).refine(v=>Object.keys(v).length>0);
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Provide valid store settings. WhatsApp must be blank or 91 plus a verified 10-digit Indian number.'});
  for(const [key,value] of Object.entries(parsed.data)){
    await pool.query(
      'INSERT INTO store_settings (setting_key,setting_value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()',
      [key,JSON.stringify(value)]
    );
  }
  await audit(req.admin.sub,'store_settings_updated','store','amdavad-oven',parsed.data);
  const result=await pool.query('SELECT setting_key,setting_value FROM store_settings ORDER BY setting_key');
  res.json({settings:Object.fromEntries(result.rows.map(r=>[r.setting_key,r.setting_value]))});
}));

app.get('/api/admin/overview',requireAuth,requireRoles('owner','manager','kitchen'),asyncRoute(async (_req,res)=>{
  const r=await pool.query(`
    SELECT COUNT(*)::int AS total_order_requests,
      COUNT(*) FILTER (WHERE status IN ('received','accepted','preparing','baking','ready','out_for_delivery'))::int AS open_orders,
      COUNT(*) FILTER (WHERE status='delivered')::int AS delivered_orders,
      COALESCE(SUM(total_rupees),0)::int AS requested_order_value_rupees,
      COALESCE(AVG(total_rupees),0)::numeric(12,2) AS average_requested_order_value_rupees,
      COALESCE(SUM(total_rupees) FILTER (WHERE payment_status='paid'),0)::int AS verified_paid_revenue_rupees
    FROM orders
    WHERE created_at >= date_trunc('day',NOW())
  `);
  const top=await pool.query(`
    SELECT product_name,SUM(quantity)::int AS units_sold,SUM(line_total_rupees)::int AS requested_value_rupees
    FROM order_items i JOIN orders o ON o.id=i.order_id
    WHERE o.created_at >= date_trunc('day',NOW())
    GROUP BY product_name ORDER BY units_sold DESC LIMIT 5
  `);
  res.json({metrics:r.rows[0],topItems:top.rows,note:'Requested order value is not revenue. Verified revenue includes only payment-provider-confirmed transactions; online payment is not enabled.'});
}));

app.get('/api/admin/orders',requireAuth,requireRoles('owner','manager','kitchen','support'),asyncRoute(async (req,res)=>{
  const limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
  const r=await pool.query(`
    SELECT o.id,o.order_number,o.customer_name,o.phone,o.area,o.address,o.fulfilment,
      o.payment_preference,o.payment_status,o.status,o.subtotal_rupees,o.discount_rupees,o.total_rupees,
      o.created_at,o.updated_at,
      COALESCE(json_agg(json_build_object('name',i.product_name,'quantity',i.quantity,'variant',i.variant,'lineTotal',i.line_total_rupees,'customisation',i.customisation) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items i ON i.order_id=o.id
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT $1
  `,[limit]);
  res.json({orders:r.rows});
}));

const transitions = {
  received:['accepted','rejected','cancelled'],
  accepted:['preparing','cancelled'],
  preparing:['baking','cancelled'],
  baking:['ready','cancelled'],
  ready:['out_for_delivery','delivered','cancelled'],
  out_for_delivery:['delivered','cancelled'],
  rejected:[],
  delivered:[],
  cancelled:[]
};
app.patch('/api/admin/orders/:id/status',requireAuth,requireRoles('owner','manager','kitchen'),asyncRoute(async (req,res)=>{
  const parsed=z.object({status:z.enum(Object.keys(transitions))}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid order status.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const current=await client.query('SELECT id,status FROM orders WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(!current.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Order not found.'});}
    if(!transitions[current.rows[0].status].includes(parsed.data.status)){await client.query('ROLLBACK');return res.status(409).json({error:'That status transition is not allowed.'});}
    const updated=await client.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,order_number,status,updated_at',[parsed.data.status,req.params.id]);
    await client.query(
      'INSERT INTO audit_logs (admin_user_id,event_type,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5)',
      [req.admin.sub,'order_status_changed','order',req.params.id,JSON.stringify({from:current.rows[0].status,to:parsed.data.status})]
    );
    await client.query('COMMIT');
    res.json({order:updated.rows[0]});
  }catch(err){await client.query('ROLLBACK');throw err;}
  finally{client.release();}
}));

app.get('/api/admin/products',requireAuth,requireRoles('owner','manager','kitchen'),asyncRoute(async (_req,res)=>{
  const r=await pool.query('SELECT * FROM products ORDER BY id');
  res.json({products:r.rows});
}));
app.patch('/api/admin/products/:id',requireAuth,requireRoles('owner','manager'),asyncRoute(async (req,res)=>{
  const parsed=z.object({price_rupees:z.number().int().min(1).max(100000).optional(),is_available:z.boolean().optional()}).refine(v=>Object.keys(v).length>0).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Provide a valid price or availability setting.'});
  const current=await pool.query('SELECT id FROM products WHERE id=$1',[req.params.id]);
  if(!current.rowCount)return res.status(404).json({error:'Product not found.'});
  const r=await pool.query('UPDATE products SET price_rupees=COALESCE($1,price_rupees),is_available=COALESCE($2,is_available),updated_at=NOW() WHERE id=$3 RETURNING id,name,price_rupees,is_available',[parsed.data.price_rupees??null,parsed.data.is_available??null,req.params.id]);
  await audit(req.admin.sub,'product_updated','product',req.params.id,parsed.data);
  res.json({product:r.rows[0]});
}));

app.get('/api/admin/marketing',requireAuth,requireRoles('owner','manager'),asyncRoute(async (_req,res)=>{
  const [summary,sources,campaigns,referrals,orders]=await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER (WHERE event_type='page_view')::int AS page_views,
      COUNT(*) FILTER (WHERE event_type='share_click')::int AS share_clicks,
      COUNT(*) FILTER (WHERE event_type='referral_visit')::int AS referral_visits,
      COUNT(*) FILTER (WHERE event_type='add_to_cart')::int AS add_to_cart,
      COUNT(*) FILTER (WHERE event_type='checkout_started')::int AS checkout_started,
      COUNT(*) FILTER (WHERE event_type='order_saved')::int AS order_saved
      FROM marketing_events WHERE created_at>=NOW()-INTERVAL '30 days'`),
    pool.query(`SELECT source,COUNT(*)::int AS events FROM marketing_events
      WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY source ORDER BY events DESC`),
    pool.query(`SELECT campaign,COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,
      COUNT(*) FILTER (WHERE event_type='share_click')::int AS shares,
      COUNT(*) FILTER (WHERE event_type='referral_visit')::int AS referrals
      FROM marketing_events WHERE created_at>=NOW()-INTERVAL '30 days'
      GROUP BY campaign ORDER BY views DESC LIMIT 20`),
    pool.query(`SELECT referral_code,COUNT(*) FILTER (WHERE event_type='referral_visit')::int AS visits,
      COUNT(*) FILTER (WHERE event_type='share_click')::int AS shares
      FROM marketing_events WHERE referral_code IS NOT NULL AND created_at>=NOW()-INTERVAL '30 days'
      GROUP BY referral_code ORDER BY visits DESC LIMIT 25`),
    pool.query(`SELECT COUNT(*)::int AS order_requests,
      COUNT(*) FILTER (WHERE referral_code IS NOT NULL)::int AS referred_order_requests,
      COALESCE(SUM(total_rupees),0)::int AS requested_value_rupees
      FROM orders WHERE created_at>=NOW()-INTERVAL '30 days'`)
  ]);
  res.json({periodDays:30,summary:summary.rows[0],sources:sources.rows,campaigns:campaigns.rows,referrals:referrals.rows,orders:orders.rows[0],note:'Events are first-party browser events, not verified unique people. Order request totals are not paid revenue; no paid ads, bot traffic, or guaranteed virality.'});
}));

app.get('/api/admin/community',requireAuth,requireRoles('owner','manager','support'),asyncRoute(async (_req,res)=>{
  const [signups,interests,votes]=await Promise.all([
    pool.query('SELECT id,customer_name,phone,neighbourhood,interest_type,referral_code,consented_at,created_at FROM community_signups ORDER BY created_at DESC LIMIT 500'),
    pool.query('SELECT neighbourhood,COUNT(*)::int AS signups FROM community_signups GROUP BY neighbourhood ORDER BY signups DESC'),
    pool.query(`SELECT choice,COUNT(*)::int AS votes FROM community_votes WHERE poll_key='first-pizza-wave-2026' GROUP BY choice ORDER BY votes DESC`)
  ]);
  res.json({signups:signups.rows,byNeighbourhood:interests.rows,pollVotes:votes.rows,note:'Only contacts that explicitly consented to launch contact appear here. Do not export or message them for unrelated promotions.'});
}));
app.get('/api/admin/audit',requireAuth,requireRoles('owner','manager'),asyncRoute(async (_req,res)=>{
  const result=await pool.query(
    'SELECT a.id,a.event_type,a.entity_type,a.entity_id,a.details,a.created_at,u.email AS actor_email FROM audit_logs a LEFT JOIN admin_users u ON u.id=a.admin_user_id ORDER BY a.created_at DESC LIMIT 200'
  );
  res.json({events:result.rows});
}));

app.get('/api/admin/support',requireAuth,requireRoles('owner','manager','support'),asyncRoute(async (_req,res)=>{
  const r=await pool.query('SELECT ticket_code,customer_name,phone,message,status,created_at FROM support_tickets ORDER BY created_at DESC LIMIT 100');
  res.json({tickets:r.rows});
}));
app.patch('/api/admin/support/:ticketCode',requireAuth,requireRoles('owner','manager','support'),asyncRoute(async (req,res)=>{
  const parsed=z.object({status:z.enum(['open','in_progress','resolved'])}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid ticket status.'});
  const r=await pool.query('UPDATE support_tickets SET status=$1,updated_at=NOW() WHERE ticket_code=$2 RETURNING ticket_code,status',[parsed.data.status,req.params.ticketCode]);
  if(!r.rowCount)return res.status(404).json({error:'Ticket not found.'});
  await audit(req.admin.sub,'support_ticket_updated','support_ticket',req.params.ticketCode,parsed.data);
  res.json({ticket:r.rows[0]});
}));

app.use((req,res)=>res.status(404).json({error:'Endpoint not found.'}));
app.use((err,_req,res,_next)=>{
  if (err.message==='Origin is not permitted by CORS.') return res.status(403).json({error:err.message});
  console.error('Request failed:',err.message);
  res.status(500).json({error:'The request could not be completed. Please try again.'});
});

async function start() {
  await migrate();
  app.listen(PORT,'0.0.0.0',()=>console.log('AMDAVAD OVEN API listening on '+PORT));
}
start().catch((err)=>{console.error('API startup failed:',err);process.exit(1);});
process.on('SIGTERM',async()=>{await pool.end();process.exit(0)});
process.on('SIGINT',async()=>{await pool.end();process.exit(0)});

module.exports = { app, pool, migrate };