import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CouponForm = ({ user, coupon, listings, onSubmit }) => {
  const isEditing = !!coupon;
  const [formData, setFormData] = useState({
    listing_id: isEditing ? coupon.listing_id : '',
    code: isEditing ? coupon.code : '',
    description: isEditing ? coupon.description : '',
    discount_type: isEditing ? coupon.discount_type : 'percentage',
    discount_value: isEditing ? coupon.discount_value : '',
    min_purchase_amount: isEditing ? coupon.min_purchase_amount || '' : '',
    max_usage: isEditing ? coupon.max_usage || '' : '',
    start_date: isEditing ? new Date(coupon.start_date).toISOString().split('T')[0] : '',
    expiry_date: isEditing ? new Date(coupon.expiry_date).toISOString().split('T')[0] : ''
  });

  useEffect(() => {
    if (isEditing) {
      setFormData({
        listing_id: coupon.listing_id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_purchase_amount: coupon.min_purchase_amount || '',
        max_usage: coupon.max_usage || '',
        start_date: new Date(coupon.start_date).toISOString().split('T')[0],
        expiry_date: new Date(coupon.expiry_date).toISOString().split('T')[0]
      });
    }
  }, [coupon]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = isEditing
        ? `${import.meta.env.VITE_API_URL}/api/coupons/${coupon.coupon_id}`
        : `${import.meta.env.VITE_API_URL}/api/coupons`;
      const method = isEditing ? 'put' : 'post';

      const response = await axios[method](
        url,
        formData,
        { headers: { Authorization: `Bearer ${user.idToken}` } }
      );
      alert(isEditing ? 'Coupon updated and submitted for review' : 'Coupon submitted for review');
      setFormData({
        listing_id: '',
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        min_purchase_amount: '',
        max_usage: '',
        start_date: '',
        expiry_date: ''
      });
      if (onSubmit) onSubmit();
    } catch (error) {
      console.error('Error submitting coupon:', error);
      alert('Error submitting coupon');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">{isEditing ? 'Edit Coupon' : 'Submit a Coupon'}</h2>
      <div className="mb-4">
        <label className="block text-gray-700">Vendor Listing</label>
        <select
          value={formData.listing_id}
          onChange={(e) => setFormData({ ...formData, listing_id: e.target.value })}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select a listing</option>
          {listings.map((listing) => (
            <option key={listing.listing_id} value={listing.listing_id}>
              {listing.title}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Coupon Code</label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Discount Type</label>
        <select
          value={formData.discount_type}
          onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Discount Value</label>
        <input
          type="number"
          value={formData.discount_value}
          onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Minimum Purchase Amount</label>
        <input
          type="number"
          value={formData.min_purchase_amount}
          onChange={(e) => setFormData({ ...formData, min_purchase_amount: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Maximum Usage</label>
        <input
          type="number"
          value={formData.max_usage}
          onChange={(e) => setFormData({ ...formData, max_usage: e.target.value })}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Start Date</label>
        <input
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Expiry Date</label>
        <input
          type="date"
          value={formData.expiry_date}
          onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <button type="submit" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
        {isEditing ? 'Update Coupon' : 'Submit Coupon'}
      </button>
    </form>
  );
};

export default CouponForm;