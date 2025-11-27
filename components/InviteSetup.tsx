
// components/InviteSetup.tsx
import React, { useEffect, useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import type { User } from "../types";
import { getUser, completeInviteRegistration } from "@/services/userService";

interface InviteSetupProps {
  householdId: string;
  userId: string;
  onComplete: (user: User) => void;
}

const InviteSetup: React.FC<InviteSetupProps> = ({ householdId, userId, onComplete }) => {
  const { user: clerkUser, isSignedIn } = useUser();
  const { redirectToSignIn } = useClerk();
  const clerkUserId = clerkUser?.id ?? null;

  const [invitedUser, setInvitedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      setLoading(true);
      setError("");

      if (!isSignedIn || !clerkUserId) {
        // Redirect to Clerk sign-in with return URL
        redirectToSignIn({ redirectUrl: window.location.href });
        return;
      }

      try {
        const data = await getUser(householdId, userId);
        if (!mounted) return;

        if (data && data.status === "pending" && new Date(data.expiresAt) > new Date()) {
          setInvitedUser(data);
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
    return () => {
      mounted = false;
    };
  }, [householdId, userId, isSignedIn, clerkUserId, redirectToSignIn]);

  async function handleAcceptInvite() {
    setError("");
    if (!clerkUserId) {
      setError("No authenticated user found. Please sign in.");
      return;
    }
    setIsSubmitting(true);
    try {
      const finalUser = await completeInviteRegistration(householdId, userId, clerkUserId);
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
        <h3 className="text-xl font-bold text-red-500">Invitation Error</h3>
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
      {error && <p className="text-red-500 mt-2">{error}</p>}
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

