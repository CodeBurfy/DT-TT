const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Get all categories (public)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('category_id, name, type');
  if (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: error.message, data: [] });
  }
  res.json(data || []);
});

module.exports = router;