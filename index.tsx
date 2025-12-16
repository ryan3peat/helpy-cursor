import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';
import { SupabaseProvider } from './contexts/SupabaseContext';

// IMPORTANT: Redirect helpyfam.com (without app. subdomain) to marketing homepage
// This runs before React renders to ensure fast redirect
const hostname = window.location.hostname;
const pathname = window.location.pathname;
const isMainDomain = hostname === 'helpyfam.com' || hostname === 'www.helpyfam.com';
const isAppSubdomain = hostname === 'app.helpyfam.com';
const isRootPath = pathname === '/' || pathname === '';

// If on main domain (not app subdomain) at root, redirect to marketing homepage
if (isMainDomain && !isAppSubdomain && isRootPath && !window.location.search.includes('invite=')) {
  window.location.href = 'https://helpy-cursor-website.vercel.app/home';
  // Prevent further execution
  throw new Error('Redirecting to marketing homepage');
}

// Log URL immediately on script load (before React)
console.log('[Index] App starting. URL:', window.location.href);
console.log('[Index] Hash:', window.location.hash);
console.log('[Index] Pathname:', window.location.pathname);

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

// Debug logging for Clerk initialization
console.log('🔵 [Clerk] Initializing with key:', clerkPubKey ? `${clerkPubKey.substring(0, 15)}...` : 'MISSING');
console.log('🔵 [Clerk] Environment:', import.meta.env.MODE);
console.log('🔵 [Clerk] Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'server');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element');
}

// Get production URL for Clerk configuration
const getProductionUrl = () => {
  return import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://helpyfam.com';
};

const root = ReactDOM.createRoot(rootElement);

// Only use custom domain in production
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'helpyfam.com' || 
   window.location.hostname === 'www.helpyfam.com');

root.render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={clerkPubKey}
      domain={isProduction ? 'helpyfam.com' : undefined}
      afterSignInUrl={typeof window !== 'undefined' ? window.location.origin : undefined}
      afterSignUpUrl={typeof window !== 'undefined' ? window.location.origin : undefined}
    >
      <SupabaseProvider>
        <App />
      </SupabaseProvider>
    </ClerkProvider>
  </React.StrictMode>
);
