// src/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const AdminDashboard = ({ user }) => {
  const [pendingListings, setPendingListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewInputs, setReviewInputs] = useState({});

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        console.log('No user provided');
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      console.log('Checking admin status for UID:', user.uid);
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('firebase_uid', user.uid)
          .single();
        console.log('Supabase userData:', userData, 'Error:', error);
        if (error) {
          console.error('Error fetching admin status:', error);
          setError('Failed to verify admin status');
          setIsAdmin(false);
        } else {
          setIsAdmin(userData?.is_admin || false);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('Unexpected error verifying admin status');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    const fetchPendingListings = async () => {
      if (!user || !isAdmin) {
        console.log('Skipping fetch: user or isAdmin invalid', { user, isAdmin });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/listings/pending`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        console.log('Pending listings:', response.data);
        setPendingListings(response.data || []);
      } catch (err) {
        console.error('Error fetching pending listings:', err);
        setError('Failed to load pending listings');
        setPendingListings([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) fetchPendingListings();
  }, [user, isAdmin]);

  const handleReview = async (listingId, status) => {
  setLoading(true);
  try {
    const idToken = await user.getIdToken();
    console.log('Firebase UID:', user.uid); // Debug UID
    const { comment, rejectionReason } = reviewInputs[listingId] || {};
    const payload = { listingId, status, comment, rejection_reason: rejectionReason };
    console.log('Sending review request:', {
      url: `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
      payload,
      idToken: idToken.substring(0, 10) + '...',
    });
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
      payload,
      { headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } }
    );
    console.log(`Review (${status}) response:`, response.data);
    setPendingListings(pendingListings.filter((l) => l.listing_id !== listingId));
    alert(`Listing ${status} successfully`);
  } catch (error) {
    console.error('Error reviewing listing:', error.response?.data || error.message);
    const errorMessage =
      error.response?.status === 403
        ? 'Access denied: Ensure you are an admin.'
        : error.response?.data?.error || error.message;
    alert(`Error reviewing listing: ${errorMessage}`);
  } finally {
    setLoading(false);
  }
};

//   const handleReview = async (listingId, status) => {
//   setLoading(true);
//   try {
//     const idToken = await user.getIdToken();
//     const { comment, rejectionReason } = reviewInputs[listingId] || {};
//     const payload = { listingId, status, comment, rejection_reason: rejectionReason };
//     console.log('Sending review request:', {
//       url: `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
//       payload,
//       idToken: idToken.substring(0, 10) + '...',
//     });
//     const response = await axios.post(
//       `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
//       payload,
//       { headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } }
//     );
//     console.log(`Review (${status}) response:`, response.data);
//     setPendingListings(pendingListings.filter((l) => l.listing_id !== listingId));
//     alert(`Listing ${status} successfully`);
//   } catch (error) {
//     console.error('Error reviewing listing:', error.response?.data || error.message);
//     const errorMessage =
//       error.response?.status === 404
//         ? 'Review endpoint not found. Please check the backend.'
//         : error.response?.data?.error || error.message;
//     alert(`Error reviewing listing: ${errorMessage}`);
//   } finally {
//     setLoading(false);
//   }
// };
// const handleReview = async (listingId, status) => {
//   setLoading(true);
//   try {
//     const idToken = await user.getIdToken();
//     console.log('Firebase UID:', user.uid); // Debug UID
//     const { comment, rejectionReason } = reviewInputs[listingId] || {};
//     const payload = { listingId, status, comment, rejection_reason: rejectionReason };
//     console.log('Sending review request:', {
//       url: `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
//       payload,
//       idToken: idToken.substring(0, 10) + '...',
//     });
//     const response = await axios.post(
//       `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
//       payload,
//       { headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } }
//     );
//     console.log(`Review (${status}) response:`, response.data);
//     setPendingListings(pendingListings.filter((l) => l.listing_id !== listingId));
//     alert(`Listing ${status} successfully`);
//   } catch (error) {
//     console.error('Error reviewing listing:', error.response?.data || error.message);
//     const errorMessage =
//       error.response?.status === 403
//         ? 'Access denied: Ensure you are an admin.'
//         : error.response?.data?.error || error.message;
//     alert(`Error reviewing listing: ${errorMessage}`);
//   } finally {
//     setLoading(false);
//   }
// };
  const handleInputChange = (listingId, field, value) => {
    setReviewInputs((prev) => ({
      ...prev,
      [listingId]: { ...prev[listingId], [field]: value },
    }));
  };

  console.log('AdminDashboard render:', { user, isAdmin, loading, pendingListings });

  if (loading) return <p className="text-center text-gray-500">Loading...</p>;
  if (!user || !isAdmin)
    return <p className="text-center text-red-500">Access denied: Admins only</p>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Admin Dashboard - Pending Listings</h2>
        <Link
          to="/"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Back to Homepage
        </Link>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {pendingListings.length === 0 && <p>No pending listings</p>}
      {pendingListings.map((listing) => (
        <div key={listing.listing_id} className="border p-4 rounded-lg mb-4">
          <h3 className="text-xl font-semibold">
            {listing.title} ({listing.type})
          </h3>
          <p className="text-gray-600">{listing.description}</p>
          <p className="text-gray-500">
            {listing.city}, {listing.state}
          </p>
          <div className="flex gap-2 mt-2">
            {Array.isArray(listing.media) &&
              listing.media.map((image, index) => (
                <img
                  key={index}
                  src={image.url}
                  alt={image.caption || 'Listing image'}
                  className="w-32 h-32 object-cover"
                />
              ))}
          </div>
          {listing.event_details && (
            <p className="mt-2">
              Event: {new Date(listing.event_details.start_date_time).toLocaleString()}
            </p>
          )}
          {listing.temple_details && (
            <p className="mt-2">
              Temple: {listing.temple_details.deity} (
              {listing.temple_details.denomination})
            </p>
          )}
          {listing.vendor_details && (
            <p className="mt-2">Vendor: {listing.vendor_details.business_type}</p>
          )}
          <p className="mt-2">Submitter: {listing.user_email || 'Unknown'}</p>
          <p className="mt-2">
            Review Comment: {listing.listing_reviews?.[0]?.comment || 'None'}
          </p>
          {listing.status === 'pending' && (
            <div className="mt-4 flex flex-col gap-2">
              <textarea
                placeholder="Review comment (optional)"
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={reviewInputs[listing.listing_id]?.comment || ''}
                onChange={(e) =>
                  handleInputChange(listing.listing_id, 'comment', e.target.value)
                }
              />
              <div className="flex gap-2">
                <button
                  className="bg-green-600 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to approve this listing?')) {
                      handleReview(listing.listing_id, 'approved');
                    }
                  }}
                  disabled={loading}
                >
                  Approve
                </button>
                <div className="flex-1">
                  <textarea
                    placeholder="Rejection reason (required for rejection)"
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={reviewInputs[listing.listing_id]?.rejectionReason || ''}
                    onChange={(e) =>
                      handleInputChange(listing.listing_id, 'rejectionReason', e.target.value)
                    }
                  />
                </div>
                <button
                  className="bg-red-600 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    const rejectionReason = reviewInputs[listing.listing_id]?.rejectionReason || '';
                    if (!rejectionReason.trim()) {
                      alert('Please provide a rejection reason.');
                      return;
                    }
                    if (window.confirm('Are you sure you want to reject this listing?')) {
                      handleReview(listing.listing_id, 'rejected');
                    }
                  }}
                  disabled={loading || !reviewInputs[listing.listing_id]?.rejectionReason?.trim()}
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminDashboard;