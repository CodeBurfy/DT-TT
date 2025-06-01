// src/AdminDashboard.jsx
// import React, { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
// import axios from 'axios';
// import { createClient } from '@supabase/supabase-js';

// // Initialize Supabase client
// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// );

// const AdminDashboard = ({ user }) => {
//   const [pendingListings, setPendingListings] = useState([]);
//   const [pendingCoupons, setPendingCoupons] = useState([]); // New state for coupons
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [isAdmin, setIsAdmin] = useState(false);
//   const [reviewInputs, setReviewInputs] = useState({});

//   useEffect(() => {
//     const checkAdminStatus = async () => {
//       if (!user) {
//         console.log('No user provided');
//         setIsAdmin(false);
//         setLoading(false);
//         return;
//       }
//       console.log('Checking admin status for UID:', user.uid);
//       try {
//         const { data: userData, error } = await supabase
//           .from('users')
//           .select('is_admin')
//           .eq('firebase_uid', user.uid)
//           .single();
//         console.log('Supabase userData:', userData, 'Error:', error);
//         if (error) {
//           console.error('Error fetching admin status:', error);
//           setError('Failed to verify admin status');
//           setIsAdmin(false);
//         } else {
//           setIsAdmin(userData?.is_admin || false);
//         }
//       } catch (err) {
//         console.error('Unexpected error:', err);
//         setError('Unexpected error verifying admin status');
//         setIsAdmin(false);
//       } finally {
//         setLoading(false);
//       }
//     };

//     checkAdminStatus();
//   }, [user]);

//   useEffect(() => {
//     const fetchPendingItems = async () => {
//       if (!user || !isAdmin) {
//         console.log('Skipping fetch: user or isAdmin invalid', { user, isAdmin });
//         return;
//       }

//       setLoading(true);
//       setError(null);
//       try {
//         const idToken = await user.getIdToken();

//         // Fetch pending listings
//         const listingsResponse = await axios.get(
//           `${import.meta.env.VITE_API_URL}/api/listings/pending`,
//           { headers: { Authorization: `Bearer ${idToken}` } }
//         );
//         console.log('Pending listings:', listingsResponse.data);
//         setPendingListings(listingsResponse.data || []);

//         // Fetch pending coupons
//         const couponsResponse = await axios.get(
//           `${import.meta.env.VITE_API_URL}/api/coupons/has-pending`,
//           { headers: { Authorization: `Bearer ${idToken}` } }
//         );
//         console.log('Pending coupons:', couponsResponse.data);
//         setPendingCoupons(couponsResponse.data || []);
//       } catch (err) {
//         console.error('Error fetching pending items:', err);
//         setError('Failed to load pending items');
//         setPendingListings([]);
//         setPendingCoupons([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (isAdmin) fetchPendingItems();
//   }, [user, isAdmin]);

//   const handleListingReview = async (listingId, status) => {
//     setLoading(true);
//     try {
//       const idToken = await user.getIdToken();
//       console.log('Firebase UID:', user.uid);
//       const { comment, rejectionReason } = reviewInputs[listingId] || {};
//       const payload = { listingId, status, comment, rejection_reason: rejectionReason };
//       console.log('Sending listing review request:', {
//         url: `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
//         payload,
//         idToken: idToken.substring(0, 10) + '...',
//       });
//       const response = await axios.post(
//         `${import.meta.env.VITE_API_URL}/api/listings/review-listing`,
//         payload,
//         { headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } }
//       );
//       console.log(`Listing review (${status}) response:`, response.data);
//       setPendingListings(pendingListings.filter((l) => l.listing_id !== listingId));
//       alert(`Listing ${status} successfully`);
//     } catch (error) {
//       console.error('Error reviewing listing:', error.response?.data || error.message);
//       const errorMessage =
//         error.response?.status === 403
//           ? 'Access denied: Ensure you are an admin.'
//           : error.response?.data?.error || error.message;
//       alert(`Error reviewing listing: ${errorMessage}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCouponReview = async (couponId, status) => {
//     setLoading(true);
//     try {
//       const idToken = await user.getIdToken();
//       console.log('Firebase UID:', user.uid);
//       const { comment, rejectionReason } = reviewInputs[couponId] || {};
//       const payload = {
//         approved_by: user.uid, // For approve
//         rejected_by: user.uid, // For reject
//         rejection_reason: rejectionReason || null,
//       };
//       console.log('Sending coupon review request:', {
//         url: `${import.meta.env.VITE_API_URL}/api/coupons/${couponId}/${status}`,
//         payload,
//         idToken: idToken.substring(0, 10) + '...',
//       });
//       const response = await axios.patch(
//         `${import.meta.env.VITE_API_URL}/api/coupons/${couponId}/${status}`,
//         payload,
//         { headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' } }
//       );
//       console.log(`Coupon review (${status}) response:`, response.data);
//       setPendingCoupons(pendingCoupons.filter((c) => c.coupon_id !== couponId));
//       alert(`Coupon ${status} successfully`);
//     } catch (error) {
//       console.error('Error reviewing coupon:', error.response?.data || error.message);
//       const errorMessage =
//         error.response?.status === 403
//           ? 'Access denied: Ensure you are an admin.'
//           : error.response?.data?.error || error.message;
//       alert(`Error reviewing coupon: ${errorMessage}`);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleInputChange = (id, field, value) => {
//     setReviewInputs((prev) => ({
//       ...prev,
//       [id]: { ...prev[id], [field]: value },
//     }));
//   };

//   console.log('AdminDashboard render:', { user, isAdmin, loading, pendingListings, pendingCoupons });

//   if (loading) return <p className="text-center text-gray-500">Loading...</p>;
//   if (!user || !isAdmin)
//     return <p className="text-center text-red-500">Access denied: Admins only</p>;

//   return (
//     <div className="container mx-auto p-4">
//       <div className="flex justify-between items-center mb-4">
//         <h2 className="text-2xl font-bold">Admin Dashboard</h2>
//         <Link
//           to="/"
//           className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
//         >
//           Back to Homepage
//         </Link>
//       </div>
//       {error && <p className="text-red-500 mb-4">{error}</p>}

//       {/* Pending Listings Section */}
//       <h3 className="text-xl font-bold mb-4">Pending Listings</h3>
//       {pendingListings.length === 0 && <p>No pending listings</p>}
//       {pendingListings.map((listing) => (
//         <div key={listing.listing_id} className="border p-4 rounded-lg mb-4">
//           <h4 className="text-xl font-semibold">
//             {listing.title} ({listing.type})
//           </h4>
//           <p className="text-gray-600">{listing.description}</p>
//           <p className="text-gray-500">
//             {listing.city}, {listing.state}
//           </p>
//           <div className="flex gap-2 mt-2">
//             {Array.isArray(listing.media) &&
//               listing.media.map((image, index) => (
//                 <img
//                   key={index}
//                   src={image.url}
//                   alt={image.caption || 'Listing image'}
//                   className="w-32 h-32 object-cover"
//                 />
//               ))}
//           </div>
//           {listing.event_details && (
//             <p className="mt-2">
//               Event: {new Date(listing.event_details.start_date_time).toLocaleString()}
//             </p>
//           )}
//           {listing.temple_details && (
//             <p className="mt-2">
//               Temple: {listing.temple_details.deity} (
//               {listing.temple_details.denomination})
//             </p>
//           )}
//           {listing.vendor_details && (
//             <p className="mt-2">Vendor: {listing.vendor_details.business_type}</p>
//           )}
//           <p className="mt-2">Submitter: {listing.user_email || 'Unknown'}</p>
//           <p className="mt-2">
//             Review Comment: {listing.listing_reviews?.[0]?.comment || 'None'}
//           </p>
//           {listing.status === 'pending' && (
//             <div className="mt-4 flex flex-col gap-2">
//               <textarea
//                 placeholder="Review comment (optional)"
//                 className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 value={reviewInputs[listing.listing_id]?.comment || ''}
//                 onChange={(e) =>
//                   handleInputChange(listing.listing_id, 'comment', e.target.value)
//                 }
//               />
//               <div className="flex gap-2">
//                 <button
//                   className="bg-green-600 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   onClick={() => {
//                     if (window.confirm('Are you sure you want to approve this listing?')) {
//                       handleListingReview(listing.listing_id, 'approved');
//                     }
//                   }}
//                   disabled={loading}
//                 >
//                   Approve
//                 </button>
//                 <div className="flex-1">
//                   <textarea
//                     placeholder="Rejection reason (required for rejection)"
//                     className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     value={reviewInputs[listing.listing_id]?.rejectionReason || ''}
//                     onChange={(e) =>
//                       handleInputChange(listing.listing_id, 'rejectionReason', e.target.value)
//                     }
//                   />
//                 </div>
//                 <button
//                   className="bg-red-600 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   onClick={() => {
//                     const rejectionReason = reviewInputs[listing.listing_id]?.rejectionReason || '';
//                     if (!rejectionReason.trim()) {
//                       alert('Please provide a rejection reason.');
//                       return;
//                     }
//                     if (window.confirm('Are you sure you want to reject this listing?')) {
//                       handleListingReview(listing.listing_id, 'rejected');
//                     }
//                   }}
//                   disabled={loading || !reviewInputs[listing.listing_id]?.rejectionReason?.trim()}
//                 >
//                   Reject
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       ))}

//       {/* Pending Coupons Section */}
//       <h3 className="text-xl font-bold mb-4 mt-8">Pending Coupons</h3>
//       {pendingCoupons.length === 0 && <p>No pending coupons</p>}
//       {pendingCoupons.map((coupon) => (
//         <div key={coupon.coupon_id} className="border p-4 rounded-lg mb-4">
//           <h4 className="text-xl font-semibold">Coupon: {coupon.code}</h4>
//           <p className="text-gray-600">{coupon.description || 'No description'}</p>
//           <p className="text-gray-500">
//             Discount: {coupon.discount_value} {coupon.discount_type === 'percentage' ? '%' : 'USD'}
//           </p>
//           <p className="text-gray-500">Location: {coupon.location || 'N/A'}</p>
//           <p className="text-gray-500">
//             Valid: {new Date(coupon.start_date).toLocaleDateString()} to{' '}
//             {new Date(coupon.expiry_date).toLocaleDateString()}
//           </p>
//           <p className="text-gray-500">
//             Min Purchase: {coupon.min_purchase_amount ? `$${coupon.min_purchase_amount}` : 'None'}
//           </p>
//           <p className="text-gray-500">
//             Max Usage: {coupon.max_usage || 'Unlimited'}
//           </p>
//           <p className="text-gray-500">
//             Submitter ID: {coupon.user_id || 'Unknown'}
//           </p>
//           {coupon.status === 'pending' && (
//             <div className="mt-4 flex flex-col gap-2">
//               <textarea
//                 placeholder="Review comment (optional)"
//                 className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 value={reviewInputs[coupon.coupon_id]?.comment || ''}
//                 onChange={(e) =>
//                   handleInputChange(coupon.coupon_id, 'comment', e.target.value)
//                 }
//               />
//               <div className="flex gap-2">
//                 <button
//                   className="bg-green-600 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   onClick={() => {
//                     if (window.confirm('Are you sure you want to approve this coupon?')) {
//                       handleCouponReview(coupon.coupon_id, 'approve');
//                     }
//                   }}
//                   disabled={loading}
//                 >
//                   Approve
//                 </button>
//                 <div className="flex-1">
//                   <textarea
//                     placeholder="Rejection reason (required for rejection)"
//                     className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                     value={reviewInputs[coupon.coupon_id]?.rejectionReason || ''}
//                     onChange={(e) =>
//                       handleInputChange(coupon.coupon_id, 'rejectionReason', e.target.value)
//                     }
//                   />
//                 </div>
//                 <button
//                   className="bg-red-600 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   onClick={() => {
//                     const rejectionReason = reviewInputs[coupon.coupon_id]?.rejectionReason || '';
//                     if (!rejectionReason.trim()) {
//                       alert('Please provide a rejection reason.');
//                       return;
//                     }
//                     if (window.confirm('Are you sure you want to reject this coupon?')) {
//                       handleCouponReview(coupon.coupon_id, 'reject');
//                     }
//                   }}
//                   disabled={loading || !reviewInputs[coupon.coupon_id]?.rejectionReason?.trim()}
//                 >
//                   Reject
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// };

// export default AdminDashboard;

// src/AdminDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const AdminDashboardPage = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please sign in.');
      }
      const idToken = await user.getIdToken();
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/pending`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      console.log('Fetched pending coupons:', response.data);
      setCoupons(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      setError(err.response?.data?.error || 'Failed to load coupons.');
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (couponId, action) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please sign in.');
      }
      const idToken = await user.getIdToken();
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/coupons/${couponId}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      await fetchCoupons();
    } catch (err) {
      console.error(`Error ${action} coupon:`, err);
      setError(err.response?.data?.error || `Failed to ${action} coupon.`);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Admin Dashboard</h1>
          <button
            onClick={() => navigate('/')}
            className="text-gray-700 hover:text-indigo-600"
          >
            Back to Home
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Pending Coupons</h2>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        {coupons.length === 0 && !error ? (
          <p className="text-gray-600 text-center">No pending coupons found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">Code</th>
                  <th className="py-3 px-6 text-left">Discount</th>
                  <th className="py-3 px-6 text-left">Location</th>
                  <th className="py-3 px-6 text-left">Valid Until</th>
                  <th className="py-3 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 text-sm">
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.coupon_id}
                    className="border-b border-gray-200 hover:bg-gray-100"
                  >
                    <td className="py-3 px-6">{coupon.code}</td>
                    <td className="py-3 px-6">
                      {coupon.discount_type === 'percentage'
                        ? `${coupon.discount_value}% off`
                        : `$${coupon.discount_value} off`}
                    </td>
                    <td className="py-3 px-6">{coupon.location || 'N/A'}</td>
                    <td className="py-3 px-6">
                      {new Date(coupon.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => handleAction(coupon.coupon_id, 'approve')}
                        className="bg-green-500 text-white px-4 py-1 rounded mr-2 hover:bg-green-600"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(coupon.coupon_id, 'reject')}
                        className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboardPage;