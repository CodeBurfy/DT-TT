import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import ListingsPage from './components/ListingsPage';
import EditListingPage from './components/EditListingPage'; // Import the new page
import ListingDetailsPage from './components/ListingDetailsPage'; // Import the new page
import FavoritesPage from './components/FavoritesPage'; // Import the new page
import LoginPage from './components/LoginPage';
import AddListingPage from './components/AddListingPage';
import AdminDashboard from './components/AdminDashboard';
import UserOnboarding from './components/UserOnboarding';
import { auth } from './firebaseConfig';
import { useAuthState } from 'react-firebase-hooks/auth';

function App() {
  
  const [user, loading, error] = useAuthState(auth);

  if (loading) return <p>Loading user...</p>;
  if (error) return <p>Error: {error.message}</p>;return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/add-listing" element={<AddListingPage />} />
        <Route path="/listing/:id" element={<ListingDetailsPage />} /> {/* New route */}
        <Route path="/edit-listing/:id" element={<EditListingPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/user-onboarding" element={<UserOnboarding />} />
        <Route path="/admin/dashboard" element={<AdminDashboard user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;