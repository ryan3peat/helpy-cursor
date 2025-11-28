
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { School } from "@/src/types/school";

interface SchoolCardProps {
  school: School;
  onEdit: (school: School) => void;
}

export default function SchoolCard({ school, onEdit }: SchoolCardProps) {
  const fullAddress = [school.address, school.city, school.state, school.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-tight">{school.name}</h3>
          {school.type && (
            <p className="text-xs text-muted-foreground">Type: {school.type}</p>
          )}
        </div>

        <Button variant="outline" onClick={() => onEdit(school)}>
          Edit
        </Button>
      </div>

      {/* Address */}
      {fullAddress && (
        <p className="text-sm text-foreground">{fullAddress}</p>
      )}

      {/* Contact */}
      {(school.phone || school.website) && (
        <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
          {school.phone && <span>📞 {school.phone}</span>}
          {school.website && (
            <a
              href={normalizeUrl(school.website)}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Website
            </a>
          )}
        </div>
      )}

      {/* Description */}
      {school.description && (
        <p className="text-sm text-muted-foreground">{school.description}</p>
      )}
    </div>
  );
}

/**
 * Ensure a valid URL (add protocol if user saved a bare domain)
 */
function normalizeUrl(url: string): string {
  try {
    // If it's already a valid absolute URL, return as-is
    // eslint-disable-next-line no-new
    new URL(url);
    return url;
  } catch {
    // Prepend https:// for bare domains
    return `https://${url}`;
  }
}
