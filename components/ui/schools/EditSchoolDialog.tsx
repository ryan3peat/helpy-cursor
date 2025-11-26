
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { School } from "@src/types/school";

type EditSchoolDialogProps = {
  open: boolean;
  school: School | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: School) => void | Promise<void>;
};

export default function EditSchoolDialog({ open, school, onOpenChange, onSave }: EditSchoolDialogProps) {
  const [form, setForm] = React.useState<School>(
    school ?? {
      id: "",
      name: "",
      type: "Primary",
      address: "",
      city: "",
      state: "",
      country: "",
      phone: "",
      website: "",
      description: "",
    }
  );

  React.useEffect(() => {
    if (school) setForm(school);
  }, [school]);

  function update<K extends keyof School>(key: K, value: School[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onSave(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Edit School</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="school-name">Name</Label>
            <Input id="school-name" value={form.name} onChange={(e) => update("name", e.currentTarget.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="school-type">Type</Label>
            <Select>
              <SelectTrigger id="school-type" className="w-full">
                <SelectValue placeholder={form.type ?? "Select type"} />
              </SelectTrigger>
              <SelectContent>
                {(["Nursery", "Kindergarten", "Primary", "Secondary", "University", "Other"] as const).map((t) => (
                  <SelectItem key={t} onClick={() => update("type", t)}>
                    {t}
                  </SelectItem>
                ))}
                <SelectSeparator />
              </SelectContent>
            </Select>
          </div>

          {/* address, city, state, country, phone, website, description ... */}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
