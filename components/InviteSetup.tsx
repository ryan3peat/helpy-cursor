import React, { useEffect, useState, useRef } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import type { User } from "../types";
import { getUser, completeInviteRegistration } from "@/services/userService";

console.log('🔄 InviteSetup rendered');

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
        const prodUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://helpyfam.com';
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
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-gray-500" size={32} />
        <span className="ml-2 text-gray-600">Loading invitation...</span>
      </div>
    );
  }

  if (!invitedUser) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-xl font-bold text-[#F06292]">Invitation Error</h3>
        <p className="text-gray-600 mt-2">{error || "Invitation invalid or expired."}</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-center">
      <h3 className="text-2xl font-bold text-gray-800">Welcome, {invitedUser.name ?? "Guest"}!</h3>
      <p className="text-gray-500 mt-2">
        Accept invitation for {invitedUser.email ?? "your account"}.
      </p>
      {error && <p className="text-[#F06292] mt-2">{error}</p>}
      <button
        onClick={handleAcceptInvite}
        disabled={isSubmitting}
        className="mt-6 w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Completing…
          </>
        ) : (
          <>
            Accept Invitation <ChevronRight size={18} />
          </>
        )}
      </button>
    </div>
  );
};

export default InviteSetup;