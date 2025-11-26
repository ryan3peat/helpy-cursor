
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

type CreateSchoolDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: Omit<School, "id">) => void | Promise<void>;
};

export default function CreateSchoolDialog({ open, onOpenChange, onCreate }: CreateSchoolDialogProps) {
  const [form, setForm] = React.useState<Omit<School, "id">>({
    name: "",
    type: "Primary",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    website: "",
    description: "",
  });

  function update<K extends keyof Omit<School, "id">>(key: K, value: Omit<School, "id">[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onCreate(form);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Add School</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
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

          {/* address, city, state, country, phone, website, description ... like your Edit dialog */}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
