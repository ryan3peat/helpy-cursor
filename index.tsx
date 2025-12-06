
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';

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
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
