import React, { useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebaseConfig';
import { signInWithPopup, signOut, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { supabase } from '../supabaseClient';

const Login = ({ setUser }) => {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        const { data, error } = await supabase
          .from('users')
          .select('user_id, role')
          .eq('firebase_uid', firebaseUser.uid)
          .single();

        if (error || !data) {
          // Create new user
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              firebase_uid: firebaseUser.uid,
              email: firebaseUser.email,
              first_name: firebaseUser.displayName?.split(' ')[0],
              last_name: firebaseUser.displayName?.split(' ')[1] || '',
              role: 'user'
            })
            .select('user_id, role')
            .single();
          setSession({ ...firebaseUser, idToken, supabase_user_id: newUser.user_id, role: newUser.role });
          setUser({ ...firebaseUser, idToken, supabase_user_id: newUser.user_id, role: newUser.role });
        } else {
          setSession({ ...firebaseUser, idToken, supabase_user_id: data.user_id, role: data.role });
          setUser({ ...firebaseUser, idToken, supabase_user_id: data.user_id, role: data.role });
        }
      } else {
        setSession(null);
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [setUser]);

  const handleGoogleLogin = async () => {
    try {
      // Configure Google provider to work with COOP
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Use signInWithPopup but with proper error handling
      const result = await signInWithPopup(auth, googleProvider);
      // Auth state change will handle the rest via useEffect
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Popup closed by user');
      } else {
        console.error('Error logging in with Google:', error);
      }
    }
  };

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // Handle successful login after redirect
          const idToken = await result.user.getIdToken();
          // Rest of your login logic
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
      }
    };
    
    handleRedirectResult();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      {session ? (
        <div>
          <p className="text-xl">Welcome, {session.displayName} ({session.role})</p>
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={handleGoogleLogin}
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
};

export default Login;
