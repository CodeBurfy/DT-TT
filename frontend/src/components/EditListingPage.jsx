import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebaseConfig';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const storage = getStorage();

const usStates = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

const EditListingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    contact_email: '',
    contact_phone: '',
    website_url: '',
    mediaCaption: '',
    eventDate: '',
    isFree: false,
    deity: '',
    denomination: '',
    businessType: '',
    activityType: '',
    schedule: '',
    category: '',
    vendorIds: [],
    activityIds: [],
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingMedia, setExistingMedia] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        navigate('/login');
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/categories`);
        setCategories(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setCategories([]);
      }
    };

    const fetchVendors = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/search`, {
          params: { type: 'vendor', status: 'approved' }
        });
        setVendors(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setVendors([]);
      }
    };

    const fetchActivities = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/search`, {
          params: { type: 'activity', status: 'approved' }
        });
        setActivities(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching activities:', err);
        setActivities([]);
      }
    };

    const fetchListing = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings/${id}`);
        const listing = response.data;
        if (!listing) {
          throw new Error('Listing not found');
        }

        // Check if the user is authorized to edit this listing
        if (user) {
          const isOwner = listing.user_id === user.uid;
          const isAdmin = listing.is_admin;
          if (!isOwner && !isAdmin) {
            setError('You are not authorized to edit this listing.');
            setFetching(false);
            return;
          }
          setCanEdit(isOwner || isAdmin);
        }

        const eventDate = listing.event_details?.start_date_time
          ? new Date(listing.event_details.start_date_time).toISOString().slice(0, 16)
          : '';

        setFormData({
          type: listing.type || '',
          title: listing.title || '',
          description: listing.description || '',
          address: listing.address || '',
          city: listing.city || '',
          state: listing.state || '',
          zip_code: listing.zip_code || '',
          contact_email: listing.contact_email || '',
          contact_phone: listing.contact_phone || '',
          website_url: listing.website_url || '',
          mediaCaption: listing.media[0]?.caption || '',
          eventDate,
          isFree: listing.event_details?.is_free || false,
          deity: listing.temple_details?.deity || '',
          denomination: listing.temple_details?.denomination || '',
          businessType: listing.vendor_details?.business_type || '',
          activityType: listing.activity_details?.activity_type || '',
          schedule: listing.activity_details?.schedule || '',
          category: listing.categories[0]?.category_id || '',
          vendorIds: listing.vendors?.map(v => v.listing_id) || [],
          activityIds: listing.activities?.map(a => a.listing_id) || [],
        });

        setExistingMedia(listing.media || []);
        if (listing.media[0]?.url) {
          setImagePreview(listing.media[0].url);
        }
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load listing');
      } finally {
        setFetching(false);
      }
    };

    fetchCategories();
    fetchVendors();
    fetchActivities();
    if (user) {
      fetchListing();
    }
  }, [id, user]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleVendorChange = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(Number(options[i].value));
      }
    }
    setFormData({ ...formData, vendorIds: selected });
  };

  const handleActivityChange = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(Number(options[i].value));
      }
    }
    setFormData({ ...formData, activityIds: selected });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file.');
        setImageFile(null);
        setImagePreview(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB.');
        setImageFile(null);
        setImagePreview(null);
        return;
      }
      setImageFile(file);
      setError(null);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.state && !usStates.some(state => state.code === formData.state)) {
      setError('Please select a valid US state abbreviation (e.g., NY)');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('User not authenticated. Please sign in again.');
      setLoading(false);
      navigate('/login');
      return;
    }

    try {
      const token = await user.getIdToken();
      if (!token) {
        throw new Error('Failed to retrieve authentication token');
      }

      let media = existingMedia;
      if (imageFile) {
        setUploadingImage(true);
        const storageRef = ref(storage, `listings/${user.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        const imageUrl = await getDownloadURL(storageRef);
        setUploadingImage(false);
        media = [{ url: imageUrl, caption: formData.mediaCaption || '' }];
      } else if (media.length > 0) {
        media = [{ url: media[0].url, caption: formData.mediaCaption || '' }];
      }

      const listingData = {
        type: formData.type,
        title: formData.title,
        description: formData.description,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        website_url: formData.website_url,
        media,
        user_id: user.uid,
        event: formData.type === 'event' ? { start_date_time: formData.eventDate, is_free: formData.isFree } : null,
        temple: formData.type === 'temple' ? { deity: formData.deity, denomination: formData.denomination } : null,
        vendor: formData.type === 'vendor' ? { business_type: formData.businessType } : null,
        activity: formData.type === 'activity' ? { activity_type: formData.activityType, schedule: formData.schedule } : null,
        category_id: formData.category ? parseInt(formData.category) : null,
        vendor_ids: formData.type === 'event' ? formData.vendorIds : [],
        activity_ids: formData.type === 'temple' ? formData.activityIds : [],
      };

      const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/listings/${id}`, listingData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Listing updated:', response.data);
      navigate(`/listing/${id}`);
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update listing');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreview && imageFile) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview, imageFile]);

  if (!user || fetching) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!canEdit) return <p className="text-red-500">You are not authorized to edit this listing.</p>;

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Edit Listing</h1>
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
            disabled
          >
            <option value="event">Event</option>
            <option value="vendor">Vendor</option>
            <option value="temple">Temple</option>
            <option value="activity">Activity</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            rows="4"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">City</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">State</label>
          <select
            name="state"
            value={formData.state}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">Select State</option>
            {usStates.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Zip Code</label>
          <input
            type="text"
            name="zip_code"
            value={formData.zip_code}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Contact Email</label>
          <input
            type="email"
            name="contact_email"
            value={formData.contact_email}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Contact Phone</label>
          <input
            type="tel"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Website URL</label>
          <input
            type="url"
            name="website_url"
            value={formData.website_url}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            placeholder="https://example.com"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Upload New Image (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full p-2 border rounded"
            disabled={uploadingImage}
          />
          {uploadingImage && <p className="text-blue-500 mt-2">Uploading image...</p>}
        </div>
        {imagePreview && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Image Preview</label>
            <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded" />
          </div>
        )}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Image Caption (optional)</label>
          <input
            type="text"
            name="mediaCaption"
            value={formData.mediaCaption}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        {formData.type === 'event' && (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Event Date</label>
              <input
                type="datetime-local"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="isFree"
                  checked={formData.isFree}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                Free Event
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Select Vendors (optional)</label>
              <select
                name="vendorIds"
                multiple
                value={formData.vendorIds}
                onChange={handleVendorChange}
                className="w-full p-2 border rounded"
              >
                {vendors.map((vendor) => (
                  <option key={vendor.listing_id} value={vendor.listing_id}>
                    {vendor.title}
                  </option>
                ))}
              </select>
              <p className="text-gray-500 text-sm mt-1">Hold Ctrl (or Cmd) to select multiple vendors.</p>
            </div>
          </>
        )}
        {formData.type === 'temple' && (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Deity</label>
              <input
                type="text"
                name="deity"
                value={formData.deity}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Denomination</label>
              <input
                type="text"
                name="denomination"
                value={formData.denomination}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Select Activities (optional)</label>
              <select
                name="activityIds"
                multiple
                value={formData.activityIds}
                onChange={handleActivityChange}
                className="w-full p-2 border rounded"
              >
                {activities.map((activity) => (
                  <option key={activity.listing_id} value={activity.listing_id}>
                    {activity.title}
                  </option>
                ))}
              </select>
              <p className="text-gray-500 text-sm mt-1">Hold Ctrl (or Cmd) to select multiple activities.</p>
            </div>
          </>
        )}
        {formData.type === 'vendor' && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Business Type</label>
            <input
              type="text"
              name="businessType"
              value={formData.businessType}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>
        )}
        {formData.type === 'activity' && (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Activity Type</label>
              <input
                type="text"
                name="activityType"
                value={formData.activityType}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                required
                placeholder="e.g., Puja, Festival, Meditation"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Schedule</label>
              <input
                type="text"
                name="schedule"
                value={formData.schedule}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., Every Sunday at 10 AM"
              />
            </div>
          </>
        )}
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={loading || uploadingImage}
        >
          {loading || uploadingImage ? 'Updating...' : 'Update Listing'}
        </button>
      </form>
      <Link
        to={`/listing/${id}`}
        className="mt-4 inline-block text-blue-500 hover:underline"
      >
        Back to Listing
      </Link>
    </div>
  );
};

export default EditListingPage;