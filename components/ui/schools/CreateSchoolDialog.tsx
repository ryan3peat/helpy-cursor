import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const SCHOOL_TYPES = [
  "Pre-Nursery",
  "Nursery",
  "Kindergarten",
  "Primary",
  "Secondary",
  "High School",
  "College",
  "University",
];

const COUNTRY_CODES = [
  { code: "+852", country: "Hong Kong" },
  { code: "+65", country: "Singapore" },
  { code: "+93", country: "Afghanistan" },
  { code: "+355", country: "Albania" },
  { code: "+213", country: "Algeria" },
  { code: "+376", country: "Andorra" },
  { code: "+244", country: "Angola" },
  { code: "+54", country: "Argentina" },
  { code: "+374", country: "Armenia" },
  { code: "+61", country: "Australia" },
  { code: "+43", country: "Austria" },
  { code: "+994", country: "Azerbaijan" },
  { code: "+973", country: "Bahrain" },
  { code: "+880", country: "Bangladesh" },
  { code: "+375", country: "Belarus" },
  { code: "+32", country: "Belgium" },
  { code: "+501", country: "Belize" },
  { code: "+229", country: "Benin" },
  { code: "+975", country: "Bhutan" },
  { code: "+591", country: "Bolivia" },
  { code: "+387", country: "Bosnia and Herzegovina" },
  { code: "+267", country: "Botswana" },
  { code: "+55", country: "Brazil" },
  { code: "+673", country: "Brunei" },
  { code: "+359", country: "Bulgaria" },
  { code: "+226", country: "Burkina Faso" },
  { code: "+257", country: "Burundi" },
  { code: "+855", country: "Cambodia" },
  { code: "+237", country: "Cameroon" },
  { code: "+236", country: "Central African Republic" },
  { code: "+235", country: "Chad" },
  { code: "+56", country: "Chile" },
  { code: "+86", country: "China" },
  { code: "+57", country: "Colombia" },
  { code: "+269", country: "Comoros" },
  { code: "+506", country: "Costa Rica" },
  { code: "+385", country: "Croatia" },
  { code: "+53", country: "Cuba" },
  { code: "+357", country: "Cyprus" },
  { code: "+420", country: "Czech Republic" },
  { code: "+243", country: "Democratic Republic of the Congo" },
  { code: "+45", country: "Denmark" },
  { code: "+253", country: "Djibouti" },
  { code: "+593", country: "Ecuador" },
  { code: "+20", country: "Egypt" },
  { code: "+503", country: "El Salvador" },
  { code: "+372", country: "Estonia" },
  { code: "+251", country: "Ethiopia" },
  { code: "+679", country: "Fiji" },
  { code: "+358", country: "Finland" },
  { code: "+33", country: "France" },
  { code: "+241", country: "Gabon" },
  { code: "+220", country: "Gambia" },
  { code: "+995", country: "Georgia" },
  { code: "+49", country: "Germany" },
  { code: "+233", country: "Ghana" },
  { code: "+30", country: "Greece" },
  { code: "+502", country: "Guatemala" },
  { code: "+224", country: "Guinea" },
  { code: "+592", country: "Guyana" },
  { code: "+509", country: "Haiti" },
  { code: "+504", country: "Honduras" },
  { code: "+36", country: "Hungary" },
  { code: "+354", country: "Iceland" },
  { code: "+91", country: "India" },
  { code: "+62", country: "Indonesia" },
  { code: "+98", country: "Iran" },
  { code: "+964", country: "Iraq" },
  { code: "+353", country: "Ireland" },
  { code: "+972", country: "Israel" },
  { code: "+39", country: "Italy" },
  { code: "+81", country: "Japan" },
  { code: "+962", country: "Jordan" },
  { code: "+254", country: "Kenya" },
  { code: "+965", country: "Kuwait" },
  { code: "+996", country: "Kyrgyzstan" },
  { code: "+856", country: "Laos" },
  { code: "+371", country: "Latvia" },
  { code: "+961", country: "Lebanon" },
  { code: "+266", country: "Lesotho" },
  { code: "+231", country: "Liberia" },
  { code: "+218", country: "Libya" },
  { code: "+370", country: "Lithuania" },
  { code: "+352", country: "Luxembourg" },
  { code: "+853", country: "Macau" },
  { code: "+261", country: "Madagascar" },
  { code: "+265", country: "Malawi" },
  { code: "+60", country: "Malaysia" },
  { code: "+960", country: "Maldives" },
  { code: "+223", country: "Mali" },
  { code: "+356", country: "Malta" },
  { code: "+222", country: "Mauritania" },
  { code: "+230", country: "Mauritius" },
  { code: "+52", country: "Mexico" },
  { code: "+373", country: "Moldova" },
  { code: "+377", country: "Monaco" },
  { code: "+976", country: "Mongolia" },
  { code: "+382", country: "Montenegro" },
  { code: "+212", country: "Morocco" },
  { code: "+258", country: "Mozambique" },
  { code: "+95", country: "Myanmar" },
  { code: "+264", country: "Namibia" },
  { code: "+977", country: "Nepal" },
  { code: "+31", country: "Netherlands" },
  { code: "+64", country: "New Zealand" },
  { code: "+505", country: "Nicaragua" },
  { code: "+227", country: "Niger" },
  { code: "+234", country: "Nigeria" },
  { code: "+47", country: "Norway" },
  { code: "+968", country: "Oman" },
  { code: "+92", country: "Pakistan" },
  { code: "+507", country: "Panama" },
  { code: "+675", country: "Papua New Guinea" },
  { code: "+595", country: "Paraguay" },
  { code: "+51", country: "Peru" },
  { code: "+63", country: "Philippines" },
  { code: "+48", country: "Poland" },
  { code: "+351", country: "Portugal" },
  { code: "+974", country: "Qatar" },
  { code: "+242", country: "Republic of the Congo" },
  { code: "+40", country: "Romania" },
  { code: "+7", country: "Russia/Kazakhstan" },
  { code: "+250", country: "Rwanda" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+221", country: "Senegal" },
  { code: "+381", country: "Serbia" },
  { code: "+248", country: "Seychelles" },
  { code: "+232", country: "Sierra Leone" },
  { code: "+421", country: "Slovakia" },
  { code: "+386", country: "Slovenia" },
  { code: "+27", country: "South Africa" },
  { code: "+82", country: "South Korea" },
  { code: "+211", country: "South Sudan" },
  { code: "+34", country: "Spain" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+249", country: "Sudan" },
  { code: "+597", country: "Suriname" },
  { code: "+268", country: "Eswatini" },
  { code: "+46", country: "Sweden" },
  { code: "+41", country: "Switzerland" },
  { code: "+963", country: "Syria" },
  { code: "+886", country: "Taiwan" },
  { code: "+992", country: "Tajikistan" },
  { code: "+255", country: "Tanzania" },
  { code: "+66", country: "Thailand" },
  { code: "+670", country: "Timor-Leste" },
  { code: "+228", country: "Togo" },
  { code: "+216", country: "Tunisia" },
  { code: "+90", country: "Turkey" },
  { code: "+993", country: "Turkmenistan" },
  { code: "+256", country: "Uganda" },
  { code: "+380", country: "Ukraine" },
  { code: "+971", country: "United Arab Emirates" },
  { code: "+44", country: "United Kingdom" },
  { code: "+1", country: "United States/Canada" },
  { code: "+598", country: "Uruguay" },
  { code: "+998", country: "Uzbekistan" },
  { code: "+58", country: "Venezuela" },
  { code: "+84", country: "Vietnam" },
  { code: "+967", country: "Yemen" },
  { code: "+260", country: "Zambia" },
  { code: "+263", country: "Zimbabwe" },
];

interface CreateSchoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    providerType: string;
    name: string;
    address: string;
    phone: string;
    note: string;
  }) => void;
}

export default function CreateSchoolDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateSchoolDialogProps) {
  const [providerType, setProviderType] = useState("");
  const [customProviderType, setCustomProviderType] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [countryCode, setCountryCode] = useState("+852");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    const finalProviderType = providerType === "Others" ? customProviderType : providerType;
    const fullPhone = phoneNumber ? `${countryCode} ${phoneNumber}` : "";

    if (!finalProviderType || !name || !address) {
      return;
    }

    onSubmit({
      providerType: finalProviderType,
      name,
      address,
      phone: fullPhone,
      note,
    });

    setProviderType("");
    setCustomProviderType("");
    setName("");
    setAddress("");
    setCountryCode("+852");
    setPhoneNumber("");
    setNote("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setProviderType("");
    setCustomProviderType("");
    setName("");
    setAddress("");
    setCountryCode("+852");
    setPhoneNumber("");
    setNote("");
    onOpenChange(false);
  };

  const isFormValid = () => {
    const finalProviderType = providerType === "Others" ? customProviderType : providerType;
    return finalProviderType && name && address;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90vh] p-0 flex flex-col overflow-x-hidden rounded-2xl" style={{ touchAction: 'pan-y pinch-zoom' }}>
        <div className="flex-shrink-0 px-4 pt-5 pb-3">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add School</DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-2" style={{ touchAction: 'pan-y pinch-zoom' }}>
          <div className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="school-type" className="text-body font-medium mb-1.5 block">Type</Label>
            <Select value={providerType} onValueChange={setProviderType}>
              <SelectTrigger id="school-type" data-testid="select-school-type" className="h-9 text-body">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="text-body">
                {SCHOOL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
            {providerType === "Others" && (
              <Input
                placeholder="Enter custom type"
                value={customProviderType}
                onChange={(e) => setCustomProviderType(e.target.value)}
                className="h-9 text-body"
                data-testid="input-custom-school-type"
              />
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-brand-primary/12"></div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-body font-medium mb-1.5 block">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type name"
              className="h-9 text-body"
              data-testid="input-school-name"
            />
          </div>

          {/* Separator */}
          <div className="border-t border-brand-primary/12"></div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-body font-medium mb-1.5 block">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address"
              className="min-h-[80px] text-body"
              data-testid="textarea-school-address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-body font-medium mb-1.5 block">Phone Number</Label>
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="h-9 w-[120px] text-body" data-testid="select-school-country-code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-body">
                  <SelectItem value="+852">+852 Hong Kong</SelectItem>
                  <SelectItem value="+65">+65 Singapore</SelectItem>
                  <SelectSeparator className="my-1" />
                  {COUNTRY_CODES.slice(2).map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} {item.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone number"
                className="h-9 flex-1 text-body"
                data-testid="input-school-phone-number"
              />
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-brand-primary/12"></div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-body font-medium mb-1.5 block">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes here"
              className="min-h-[80px] text-body"
              data-testid="textarea-school-note"
            />
          </div>
        </div>
        </div>

        {/* Floating Action Buttons */}
        <div className="flex-shrink-0 px-4 pt-3 pb-5 border-t border-brand-primary/12 bg-background shadow-2xl rounded-b-xl">
          <div className="flex gap-2.5">
            <Button variant="glass" onClick={handleCancel} className="flex-1 h-9 text-body" data-testid="button-school-cancel">
              Cancel
            </Button>
            <Button
              variant="glass-selected"
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className="flex-1 h-9 text-body text-white"
              data-testid="button-school-create"
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
