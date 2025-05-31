const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Submit a coupon (authenticated users, typically vendors)
router.post('/', authMiddleware, async (req, res) => {
  const { listing_id, code, description, discount_type, discount_value, min_purchase_amount, max_usage, start_date, expiry_date } = req.body;
  const { supabase_user_id } = req.user;

  // Verify user owns the listing
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('user_id')
    .eq('listing_id', listing_id)
    .single();
  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.user_id !== supabase_user_id) return res.status(403).json({ error: 'Only the listing owner can create a coupon' });

  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .insert([{
      listing_id,
      user_id: supabase_user_id,
      code,
      description,
      discount_type,
      discount_value,
      min_purchase_amount,
      max_usage,
      start_date,
      expiry_date,
      status: 'pending'
    }])
    .select()
    .single();
  if (couponError) return res.status(500).json({ error: couponError.message });

  // Insert review entry
  const { error: reviewError } = await supabase
    .from('coupon_reviews')
    .insert([{ coupon_id: coupon.coupon_id, status: 'pending', comment: 'Awaiting admin review' }]);
  if (reviewError) return res.status(500).json({ error: reviewError.message });

  res.status(201).json(coupon);
});

// Update a coupon (creator only)
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { code, description, discount_type, discount_value, min_purchase_amount, max_usage, start_date, expiry_date } = req.body;
  const { supabase_user_id } = req.user;

  // Verify creator
  const { data: coupon, error: fetchError } = await supabase
    .from('coupons')
    .select('user_id, status')
    .eq('coupon_id', id)
    .single();
  if (fetchError || !coupon) return res.status(404).json({ error: 'Coupon not found' });
  if (coupon.user_id !== supabase_user_id) return res.status(403).json({ error: 'Only the creator can update this coupon' });

  // Update coupon
  const updateData = {
    code,
    description,
    discount_type,
    discount_value,
    min_purchase_amount,
    max_usage,
    start_date,
    expiry_date,
    updated_at: new Date()
  };
  if (coupon.status === 'approved' || coupon.status === 'active') {
    updateData.status = 'pending';
    updateData.approved_by = null;
    updateData.approved_at = null;
    updateData.rejection_reason = null;
  }
  const { data: updatedCoupon, error: couponError } = await supabase
    .from('coupons')
    .update(updateData)
    .eq('coupon_id', id)
    .select()
    .single();
  if (couponError) return res.status(500).json({ error: couponError.message });

  // Insert review entry if status changed to pending
  if (coupon.status === 'approved' || coupon.status === 'active') {
    const { error: reviewError } = await supabase
      .from('coupon_reviews')
      .insert([{ coupon_id: id, status: 'pending', comment: 'Awaiting admin review for coupon update' }]);
    if (reviewError) return res.status(500).json({ error: reviewError.message });

    // Notify user
    await supabase.from('notifications').insert({
      user_id: supabase_user_id,
      coupon_id: id,
      message: `Your update to coupon "${code}" has been submitted for review`,
      notification_type: 'coupon_approval'
    });
  }

  res.json(updatedCoupon);
});

// Admin: Review and approve/reject coupons
router.put('/:id/review', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, comment, rejection_reason } = req.body;
  const { supabase_user_id } = req.user;

  const { error: reviewError } = await supabase
    .from('coupon_reviews')
    .insert([{ coupon_id: id, admin_id: supabase_user_id, status, comment }]);
  if (reviewError) return res.status(500).json({ error: reviewError.message });

  const updateData = { status: status === 'approved' ? 'active' : status, approved_by: supabase_user_id, approved_at: new Date() };
  if (status === 'rejected') updateData.rejection_reason = rejection_reason;

  const { data, error } = await supabase
    .from('coupons')
    .update(updateData)
    .eq('coupon_id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Notify submitter
  const { data: coupon } = await supabase.from('coupons').select('user_id').eq('coupon_id', id).single();
  const message = status === 'approved'
    ? `Your coupon "${data.code}" has been approved`
    : `Your coupon "${data.code}" was rejected: ${rejection_reason}`;
  await supabase.from('notifications').insert({
    user_id: coupon.user_id,
    coupon_id: id,
    message,
    notification_type: status === 'approved' ? 'coupon_approval' : 'coupon_rejection'
  });

  res.json(data);
});

// Admin: Get pending coupons for review
router.get('/pending', adminMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select(`
      *,
      coupon_reviews(comment, status),
      listings(title),
      users(email)
    `)
    .eq('status', 'pending')
    .eq('coupon_reviews.status', 'pending');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get user’s coupons (authenticated users)
router.get('/my-coupons', authMiddleware, async (req, res) => {
  const { supabase_user_id } = req.user;
  const { data, error } = await supabase
    .from('coupons')
    .select(`
      *,
      listings(title)
    `)
    .eq('user_id', supabase_user_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;