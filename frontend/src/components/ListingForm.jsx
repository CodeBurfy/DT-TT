import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';

const ListingForm = ({ user, listing, onSubmit }) => {
  const isEditing = !!listing;
  const [formData, setFormData] = useState({
    type: isEditing ? listing.type : 'event',
    title: isEditing ? listing.title : '',
    description: isEditing ? listing.description : '',
    address: isEditing ? listing.address : '',
    city: isEditing ? listing.city : '',
    state: isEditing ? listing.state : '',
    zip_code: isEditing ? listing.zip_code : '',
    images: isEditing ? listing.media : [],
    details: isEditing
      ? (listing.event_details || listing.temple_details || listing.vendor_details || {})
      : {}
  });

  useEffect(() => {
    if (isEditing) {
      setFormData({
        type: listing.type,
        title: listing.title,
        description: listing.description,
        address: listing.address,
        city: listing.city,
        state: listing.state,
        zip_code: listing.zip_code,
        images: listing.media,
        details: listing.event_details || listing.temple_details || listing.vendor_details || {}
      });
    }
  }, [listing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.type === 'vendor' && formData.images.length !== 2) {
      alert('Vendors must submit exactly 2 images');
      return;
    }
    if (formData.type === 'event' && formData.images.length !== 1) {
      alert('Events must submit exactly 1 image');
      return;
    }

    try {
      // Upload images to Supabase Storage
      const uploadedImages = await Promise.all(
        formData.images.map(async (item, index) => {
          if (typeof item === 'string' || item.url) {
            return { url: item.url || item, caption: `Image ${index + 1}` };
          }
          const { data, error } = await supabase.storage
            .from('images')
            .upload(`public/${user.uid}/${item.name}`, item);
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path);
          return { url: urlData.publicUrl, caption: `Image ${index + 1}` };
        })
      );

      const payload = { ...formData, images: uploadedImages };
      const url = isEditing
        ? `${import.meta.env.VITE_API_URL}/api/listings/${listing.listing_id}`
        : `${import.meta.env.VITE_API_URL}/api/listings`;
      const method = isEditing ? 'put' : 'post';

      const response = await axios[method](
        url,
        payload,
        { headers: { Authorization: `Bearer ${user.idToken}` } }
      );
      alert(isEditing ? 'Listing updated and submitted for review' : 'Listing submitted for review');
      setFormData({ type: 'event', title: '', description: '', address: '', city: '', state: '', zip_code: '', images: [], details: {} });
      if (onSubmit) onSubmit();
    } catch (error) {
      console.error('Error submitting listing:', error);
      alert('Error submitting listing');
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (formData.type === 'vendor' && files.length > 2) {
      alert('Vendors can only upload 2 images');
      return;
    }
    if (formData.type === 'event' && files.length > 1) {
      alert('Events can only upload 1 image');
      return;
    }
    setFormData({ ...formData, images: files });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">{isEditing ? 'Edit Listing' : 'Submit a Listing'}</h2>
      <div className="mb-4">
        <label className="block text-gray-700">Type</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full p-2 border rounded"
          disabled={isEditing}
        >
          <option value="event">Event</option>
          <option value="temple">Temple</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
        <label className="block text-gray-700">Address</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">City</label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">State</label>
        <input
          type="text"
          value={formData.state}
          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Zip Code</label>
        <input
          type="text"
          value={formData.zip_code}
          onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="w-full p-2 border rounded"
        />
        <p className="text-sm text-gray-500">
          {formData.type === 'vendor' ? 'Upload exactly 2 images' : formData.type === 'event' ? 'Upload 1 image' : 'Upload up to 1 image (optional)'}
        </p>
        {isEditing && formData.images.length > 0 && (
          <div className="mt-2">
            <p>Current Images:</p>
            {formData.images.map((image, index) => (
              <img key={index} src={image.url || image} alt={`Image ${index + 1}`} className="w-32 h-32 object-cover inline-block mr-2" />
            ))}
          </div>
        )}
      </div>
      {formData.type === 'event' && (
        <>
          <div className="mb-4">
            <label className="block text-gray-700">Start DateTime</label>
            <input
              type="datetime-local"
              value={formData.details.start_date_time || ''}
              onChange={(e) => setFormData({ ...formData, details: { ...formData.details, start_date_time: e.target.value } })}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Is Free</label>
            <input
              type="checkbox"
              checked={formData.details.is_free || false}
              onChange={(e) => setFormData({ ...formData, details: { ...formData.details, is_free: e.target.checked } })}
              className="p-2"
            />
          </div>
        </>
      )}
      {formData.type === 'temple' && (
        <>
          <div className="mb-4">
            <label className="block text-gray-700">Deity</label>
            <input
              type="text"
              value={formData.details.deity || ''}
              onChange={(e) => setFormData({ ...formData, details: { ...formData.details, deity: e.target.value } })}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Denomination</label>
            <input
              type="text"
              value={formData.details.denomination || ''}
              onChange={(e) => setFormData({ ...formData, details: { ...formData.details, denomination: e.target.value } })}
              className="w-full p-2 border rounded"
            />
          </div>
        </>
      )}
      {formData.type === 'vendor' && (
        <div className="mb-4">
          <label className="block text-gray-700">Business Type</label>
          <input
            type="text"
            value={formData.details.business_type || ''}
            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, business_type: e.target.value } })}
            className="w-full p-2 border rounded"
          />
        </div>
      )}
      <button type="submit" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
        {isEditing ? 'Update Listing' : 'Submit Listing'}
      </button>
    </form>
  );
};

export default ListingForm;