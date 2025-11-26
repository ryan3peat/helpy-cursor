import { Button } from "@/components/ui/button";
import { Pencil, Trash2, MapPin, Phone, FileText } from "lucide-react";
import type { School } from "@shared/schema";

interface SchoolCardProps {
  school: School;
  onEdit: (school: School) => void;
  onDelete: (id: string) => void;
}

export default function SchoolCard({
  school,
  onEdit,
  onDelete,
}: SchoolCardProps) {
  return (
    <div
      className="glass-surface p-5 border-0 relative"
      style={{
        borderRadius: '16px',
      }}
      data-testid={`card-school-${school.id}`}
    >
      {/* Edit and Delete buttons - absolutely positioned at top-right */}
      <div className="absolute top-2 right-2 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(school)}
          data-testid={`button-edit-school-${school.id}`}
        >
          <Pencil className="w-4 h-4 text-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(school.id)}
          data-testid={`button-delete-school-${school.id}`}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      <div className="space-y-2 pr-2">
        {/* First line: School Type */}
        <div>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border/12 whitespace-nowrap inline-block">
            {school.providerType}
          </span>
        </div>
        
        {/* Second line: School Name */}
        <div>
          <h3 className="text-body font-bold text-foreground">
            {school.name}
          </h3>
        </div>
        
        {/* Third line: Contact Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-body text-foreground">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{school.address}</span>
          </div>
          {school.phone && (
            <div className="flex items-center gap-2 text-body text-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{school.phone}</span>
            </div>
          )}
          {school.note && (
            <>
              {/* Separator - only shown if note exists */}
              <div className="border-t border-border/12" />
              <div className="flex items-start gap-2 text-body text-muted-foreground">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-line">{school.note}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
