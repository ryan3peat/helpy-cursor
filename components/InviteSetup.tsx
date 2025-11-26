
// components/InviteSetup.tsx
import React, { useEffect, useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import type { User } from "../types";
import { getUser, completeInviteRegistration } from "@/services/userService";

interface InviteSetupProps {
  householdId: string;
  onComplete: (user: User) => void;
}

const InviteSetup: React.FC<InviteSetupProps> = ({ householdId, onComplete }) => {
  const { user: clerkUser, isSignedIn } = useUser();
  const clerkUserId = clerkUser?.id ?? null;

  const [invitedUser, setInvitedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      setLoading(true);
      setError("");

      if (!isSignedIn || !clerkUserId) {
        setError("Please sign in to continue.");
        setLoading(false);
        return;
      }

      try {
        const data = await getUser(householdId, clerkUserId);
        if (!mounted) return;

        if (data) setInvitedUser(data);
        else setError("Invitation invalid or expired.");
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
  }, [householdId, isSignedIn, clerkUserId]);

  async function handleAcceptInvite() {
    setError("");

    if (!clerkUserId) {
      setError("No authenticated user found. Please sign in.");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalUser = await completeInviteRegistration(householdId, clerkUserId);
      onComplete(finalUser);
    } catch (e: any) {
      const msg = (e?.message as string) || "Failed to complete registration.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading invitation...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return <div>Please sign in to accept your invitation.</div>;
  }

  if (!invitedUser) {
    return (
      <div className="text-red-600">
        <h2 className="font-semibold mb-2">Invitation Error</h2>
        <p>{error || "Invitation invalid or expired."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome, {invitedUser.name ?? "Guest"}!</h2>
        <p className="text-sm text-muted-foreground">
          Accept invitation for {invitedUser.email ?? "your account"}.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleAcceptInvite}
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Completing…
          </>
        ) : (
          <>
            Accept Invitation
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
};

export default InviteSetup;

