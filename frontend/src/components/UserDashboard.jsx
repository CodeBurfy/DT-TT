import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ListingForm from './ListingForm';
import CouponForm from './CouponForm';

const UserDashboard = ({ user }) => {
  const [listings, setListings] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [editingListing, setEditingListing] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listingsResponse, couponsResponse] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/listings/my-listings`, {
          headers: { Authorization: `Bearer ${user.idToken}` }
        }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/coupons/my-coupons`, {
          headers: { Authorization: `Bearer ${user.idToken}` }
        })
      ]);

      // Ensure listings is an array
      setListings(Array.isArray(listingsResponse.data) ? listingsResponse.data : []);
      // Ensure coupons is an array
      setCoupons(Array.isArray(couponsResponse.data) ? couponsResponse.data : []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load listings and coupons. Please try again.');
      setListings([]); // Reset to empty array on error
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const handleListingSubmit = () => {
    setEditingListing(null);
    fetchUserData();
  };

  const handleCouponSubmit = () => {
    setEditingCoupon(null);
    fetchUserData();
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">My Dashboard</h2>
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <h3 className="text-xl font-semibold mb-2">My Listings</h3>
      {editingListing ? (
        <ListingForm user={user} listing={editingListing} onSubmit={handleListingSubmit} />
      ) : (
        <>
          <ListingForm user={user} onSubmit={handleListingSubmit} />
          <div className="mt-4">
            {!loading && !error && listings.length === 0 && <p>No listings found</p>}
            {Array.isArray(listings) && listings.map((listing) => (
              <div key={listing.listing_id} className="border p-4 rounded-lg mb-4">
                <h4 className="text-lg font-semibold">{listing.title} ({listing.type})</h4>
                <p className="text-gray-600">{listing.description}</p>
                <p className="text-gray-500">{listing.city}, {listing.state}</p>
                <p className="text-gray-500">Status: {listing.status}</p>
                <div className="flex gap-2 mt-2">
                  {Array.isArray(listing.media) && listing.media.map((image, index) => (
                    <img key={index} src={image.url} alt={image.caption} className="w-32 h-32 object-cover" />
                  ))}
                </div>
                <button
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
                  onClick={() => setEditingListing(listing)}
                >
                  Edit Listing
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <h3 className="text-xl font-semibold mb-2 mt-6">My Coupons</h3>
      {editingCoupon ? (
        <CouponForm user={user} coupon={editingCoupon} listings={listings.filter(l => l.type === 'vendor' && l.status === 'approved')} onSubmit={handleCouponSubmit} />
      ) : (
        <>
          <CouponForm user={user} listings={listings.filter(l => l.type === 'vendor' && l.status === 'approved')} onSubmit={handleCouponSubmit} />
          <div className="mt-4">
            {!loading && !error && coupons.length === 0 && <p>No coupons found</p>}
            {Array.isArray(coupons) && coupons.map((coupon) => (
              <div key={coupon.coupon_id} className="border p-4 rounded-lg mb-4">
                <h4 className="text-lg font-semibold">{coupon.code}</h4>
                <p className="text-gray-600">{coupon.description}</p>
                <p className="text-gray-500">Listing: {coupon.listings.title}</p>
                <p className="text-gray-500">Status: {coupon.status}</p>
                <button
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
                  onClick={() => setEditingCoupon(coupon)}
                >
                  Edit Coupon
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UserDashboard;