const _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})
