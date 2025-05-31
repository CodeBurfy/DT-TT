const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

router.post('/sync', async (req, res) => {
  const { firebase_uid, email, first_name, last_name } = req.body;

  try {
    if (!firebase_uid || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upsert user
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          firebase_uid,
          email,
          first_name,
          last_name,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'firebase_uid' }
      )
      .select('user_id')
      .single();

    if (error) {
      console.error('User sync error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ user_id: data.user_id });
  } catch (err) {
    console.error('User sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;