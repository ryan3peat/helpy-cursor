
export type School = {
    id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
    website?: string;
    description?: string;
    type?: "Nursery" | "Kindergarten" | "Primary" | "Secondary" | "University" | "Other";
  };
  