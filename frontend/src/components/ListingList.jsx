import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ListingList = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/listings`);
        
        if (!response.data) {
          setListings([]);
          return;
        }
        
        setListings(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Error fetching listings:', err);
        setError('Failed to load listings');
        setListings([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchListings();
  }, []);

  if (loading) return <p>Loading listings...</p>;
  if (error) return <p>{error}</p>;
  if (!listings.length) return <p>No listings available</p>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Approved Listings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.isArray(listings) ? listings.map((listing) => (
          <div key={listing.listing_id} className="border p-4 rounded-lg">
            <h3 className="text-xl font-semibold">{listing.title}</h3>
            <p className="text-gray-600">{listing.description}</p>
            <p className="text-gray-500">{listing.city}, {listing.state}</p>
            {listing.media.map((image, index) => (
              <img key={index} src={image.url} alt={image.caption} className="w-full h-48 object-cover mt-2" />
            ))}
            {listing.event_details && (
              <p className="mt-2">Event: {new Date(listing.event_details.start_date_time).toLocaleString()}</p>
            )}
            {listing.temple_details && (
              <p className="mt-2">Temple: {listing.temple_details.deity} ({listing.temple_details.denomination})</p>
            )}
            {listing.vendor_details && (
              <p className="mt-2">Vendor: {listing.vendor_details.business_type}</p>
            )}
          </div>
        )) : <p>No listings available</p>}
      </div>
    </div>
  );
};

export default ListingList;
