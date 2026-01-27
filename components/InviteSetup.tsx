import React, { useEffect, useState, useRef } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import type { User } from "../types";
import ErrorBanner from "./ui/ErrorBanner";
import { getUser, completeInviteRegistration } from "@/services/userService";
import { logger } from '../utils/logger';

logger.log('🔄 InviteSetup rendered');

// Loading component for auth states  
const AuthLoading = () => (
  <div 
    className="fixed inset-0 flex flex-col items-center justify-center p-6 auth-gradient-bg overflow-hidden"
    style={{ touchAction: 'none' }}
  >
    {/* Loading bar only - no logo/text to avoid jarring transition from iOS splash */}
    <div className="auth-loading-bar mx-auto">
      <div className="auth-loading-bar-fill" />
    </div>
  </div>
);

interface InviteSetupProps {
  householdId: string;
  userId: string;
  onComplete: (user: User) => void;
}

const InviteSetup: React.FC<InviteSetupProps> = ({ householdId, userId, onComplete }) => {
  // 1. ✅ FIX: Destructure isLoaded to know when Clerk is ready
  const { user: clerkUser, isSignedIn, isLoaded } = useUser();
  const { redirectToSignIn } = useClerk();
  const clerkUserId = clerkUser?.id ?? null;

  const [invitedUser, setInvitedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasCompleted = useRef(false);

  useEffect(() => {
    // 2. ✅ FIX: Stop immediately if Clerk hasn't loaded yet
    if (!isLoaded) return;

    let mounted = true;
  
    async function loadUser() {
      if (hasCompleted.current) return;

      setLoading(true);
      setError("");
  
      // Now safe to check isSignedIn because we know isLoaded is true
      if (!isSignedIn || !clerkUserId) {
        // Use production URL for redirect
        const prodUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://app.helpyfam.com';
        const redirectUrl = `${prodUrl}?invite=true&hid=${householdId}&uid=${userId}`;
        redirectToSignIn({ redirectUrl: redirectUrl });
        return;
      }
  
      try {
        const data = await getUser(householdId, userId);
        if (!mounted) return;

        // If user is already active, complete immediately
        if (data && data.status === "active") {
          if (hasCompleted.current) return; 
          hasCompleted.current = true;
          window.history.replaceState({}, '', window.location.pathname);
          onComplete(data);
          return;
        }
  
        // Check pending status and expiration
        if (data && data.status === "pending") {
          if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
            setError("Invitation expired. Please request a new invite link.");
          } else {
            setInvitedUser(data);
          }
        } else {
          setError("Invitation invalid or expired.");
        }
      } catch {
        setError("Could not load invitation.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
  
    loadUser();
    return () => { mounted = false; };
  }, [householdId, userId, isSignedIn, clerkUserId, redirectToSignIn, onComplete, isLoaded]); // 3. ✅ FIX: Add isLoaded to dependencies

  async function handleAcceptInvite() {
    if (hasCompleted.current) return;

    setError("");
    if (!clerkUserId) {
      setError("No authenticated user found. Please sign in.");
      return;
    }
    setIsSubmitting(true);
    try {
      const finalUser = await completeInviteRegistration(householdId, userId, clerkUserId);

      hasCompleted.current = true;
      
      // Clear the invite params from URL
      window.history.replaceState({}, '', window.location.pathname);
      
      onComplete(finalUser);
    } catch (e: any) {
      const msg = (e?.message as string) ?? "Failed to complete registration.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <AuthLoading />;
  }

  if (!invitedUser) {
    return (
      <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in auth-gradient-bg">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-10">
            <img 
              src="/helpy-logo-blue.png" 
              alt="Helpy" 
              className="h-12 w-auto"
            />
          </div>
          <h1 className="text-display font-bold text-destructive mb-4">Invitation Error</h1>
          <p className="text-body font-medium text-muted-foreground mb-8">
            {error || "Invitation invalid or expired."}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-6 pt-16 page-fade-in auth-gradient-bg">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-10">
          <img 
            src="/helpy-logo-blue.png" 
            alt="Helpy" 
            className="h-12 w-auto"
          />
        </div>
        
        <div className="mb-8">
          <h1 className="text-display font-bold text-foreground mb-2">
            Welcome, {invitedUser.name ?? "Guest"}!
          </h1>
          <p className="text-body font-medium text-muted-foreground">
            Accept invitation for {invitedUser.email ?? "your account"}.
          </p>
        </div>

        <ErrorBanner 
          error={error} 
          onDismiss={() => setError('')} 
          title="Error"
          className="mb-6"
        />

        <button
          onClick={handleAcceptInvite}
          disabled={isSubmitting}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Completing...
            </>
          ) : (
            <>
              Accept Invitation <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InviteSetup;
