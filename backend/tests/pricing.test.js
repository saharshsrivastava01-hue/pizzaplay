'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCart, calculateDiscount } = require('../pricing');

const products = [
  {id:1,name:'Margherita',is_available:true,is_pizza:true,is_veg:true,price_rupees:249},
  {id:4,name:'Paneer Tikka',is_available:true,is_pizza:true,is_veg:true,price_rupees:369},
  {id:13,name:'BBQ Chicken',is_available:true,is_pizza:true,is_veg:false,price_rupees:429},
  {id:17,name:'Garlic Bread',is_available:true,is_pizza:false,is_veg:true,price_rupees:149}
];

test('prices a regular and large menu item on the server',()=>{
  const result=calculateCart([
    {type:'standard',productId:1,size:'regular',quantity:2},
    {type:'standard',productId:17,size:'regular',quantity:1},
    {type:'standard',productId:13,size:'large',quantity:1}
  ],products);
  assert.equal(result.subtotal,249*2+149+529);
});

test('prices a custom half-and-half pizza using server catalog prices',()=>{
  const result=calculateCart([{
    type:'custom',
    config:{baseProductId:1,halfProductId:4,size:'large',crust:'cheese_burst',toppings:['extra_cheese','olives'],notes:'light chilli'},
    quantity:1
  }],products);
  assert.equal(result.subtotal,369+35+100+80+60);
  assert.equal(result.lines[0].customisation.notes,'light chilli');
});

test('rejects mixed veg and non-veg half-and-half',()=>{
  assert.throws(()=>calculateCart([{
    type:'custom',config:{baseProductId:1,halfProductId:13,size:'regular',crust:'classic',toppings:[]},quantity:1
  }],products),/same dietary category/);
});

test('rejects client cart price tampering because prices are read from products',()=>{
  const result=calculateCart([{type:'standard',productId:1,size:'regular',quantity:1,price:1}],products);
  assert.equal(result.subtotal,249);
});

test('promotions remain disabled unless the store explicitly enables them',()=>{
  assert.throws(()=>calculateDiscount('OVEN10',500,true,false),/not enabled/);
  assert.equal(calculateDiscount('OVEN10',500,true,true),50);
  assert.equal(calculateDiscount('FIRST50',500,true,true),50);
  assert.throws(()=>calculateDiscount('FIRST50',500,false,true),/not eligible/);
});
