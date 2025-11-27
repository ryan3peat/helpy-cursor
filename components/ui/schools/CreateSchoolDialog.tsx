// components/HouseholdInfo.tsx
import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Phone,
  Wifi,
  Plus,
  X,
  Save,
  Trash2,
  FileText,
  Folder,
} from "lucide-react";
import { Section, BaseViewProps } from "@/types";

// ---- Schools UI & types ----
import type { School } from "@src/types/school";
import { Button } from "@/components/ui/button";
import SchoolCard from "@/components/ui/schools/SchoolCard";
import CreateSchoolDialog from "@/components/ui/schools/CreateSchoolDialog";
import EditSchoolDialog from "@/components/ui/schools/EditSchoolDialog";

// ---- Services ----
import {
  listSchoolsByHousehold,
  createSchoolForHousehold,
  updateSchoolForHousehold,
} from "@/services/schoolService";

interface HouseholdInfoProps extends BaseViewProps {
  householdId: string;
  sections: Section[];
  onAdd: (section: Section) => void;
  onUpdate: (id: string, data: Partial<Section>) => void;
  onDelete: (id: string) => void;
  currentUser: { name: string }; // You can extend this type if needed
}

const HouseholdInfo: React.FC<HouseholdInfoProps> = ({
  householdId,
  sections,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentUser,
}) => {
  // ——— Household Sections (WiFi, Contacts, etc.) ———
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "General",
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const allCategories = Array.from(new Set(sections.map((s) => s.category)));
  const categoriesForFilter = ["All", ...allCategories];

  const getCategoryLabel = (cat: string) => {
    if (cat === "All") return t["filter.all"];
    const key = `info.cat.${cat.toLowerCase().replace(/\s+/g, "_")}`;
    return t[key] ?? cat;
  };

  const handleEditClick = (section: Section) => {
    setCurrentSection(section);
    setFormData({
      title: section.title,
      content: section.content,
      category: section.category,
    });
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setCurrentSection(null);
    setFormData({
      title: "",
      content: "",
      category: selectedCategory === "All" ? "General" : selectedCategory,
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    if (currentSection) {
      onUpdate(currentSection.id, {
        title: formData.title,
        content: formData.content,
        category: formData.category,
      });
    } else {
      onAdd({
        id: crypto.randomUUID(),
        title: formData.title,
        content: formData.content,
        category: formData.category,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (currentSection) {
      onDelete(currentSection.id);
      setIsModalOpen(false);
    }
  };

  const filteredSections = sections.filter(
    (s) => selectedCategory === "All" || s.category === selectedCategory
  );

  // ——— Schools Management ———
  const [schools, setSchools] = useState<School[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchSchools() {
      try {
        const data = await listSchoolsByHousehold(householdId);
        if (mounted) setSchools(data);
      } catch (e) {
        console.error("Failed to load schools:", e);
      }
    }
    fetchSchools();
    return () => {
      mounted = false;
    };
  }, [householdId]);

  const handleCreateSchool = async (payload: Omit<School, "id">) => {
    try {
      const created = await createSchoolForHousehold(householdId, payload);
      setSchools((prev) => [...prev, created]);
    } catch (e) {
      console.error("Failed to create school:", e);
    }
  };

  const handleUpdateSchool = async (updated: School) => {
    try {
      const result = await updateSchoolForHousehold(householdId, updated);
      setSchools((prev) => prev.map((s) => (s.id === result.id ? result : s)));
      setEditingSchool(null);
    } catch (e) {
      console.error("Failed to update school:", e);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Hi {currentUser.name}, in this section you will find important household
          information and school details.
        </h1>
      </div>

      {/* Category Filter + Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categoriesForFilter.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-brand-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
        <button
          onClick={handleAddClick}
          className="p-2 bg-brand-primary text-white rounded-full hover:bg-brand-secondary transition-colors shadow-md"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Household Sections List */}
      <div className="space-y-4 mb-10">
        {filteredSections.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {t["info.no_sections"] || "No information added yet."}
          </p>
        ) : (
          filteredSections.map((section) => (
            <div
              key={section.id}
              onClick={() => handleEditClick(section)}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800">{section.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {section.content}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  {section.category === "School" && <BookOpen size={16} />}
                  {section.category === "Contacts" && <Phone size={16} />}
                  {section.category === "Utilities" && <Wifi size={16} />}
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">{section.category}</div>
            </div>
          ))
        )}
      </div>

      {/* Schools Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-800">
            {t["info.schools"] || "Schools"}
          </h2>
          <Button onClick={() => setIsCreateOpen(true)} variant="outline">
            Add School
          </Button>
        </div>

        <div className="space-y-4">
          {schools.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No schools added yet.
            </p>
          ) : (
            schools.map((school) => (
              <div key={school.id}>
                <SchoolCard
                  school={school}
                  onEdit={() => setEditingSchool(school)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateSchoolDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={handleCreateSchool}
      />

      {editingSchool && (
        <EditSchoolDialog
          open={!!editingSchool}
          onOpenChange={(open) => !open && setEditingSchool(null)}
          school={editingSchool}
          onSave={handleUpdateSchool}
        />
      )}

      {/* Household Section Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {currentSection ? "Edit Info" : "Add New Info"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Category
                </label>
                <input
                  list="categories"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="e.g. Utilities, Contacts"
                />
                <datalist id="categories">
                  {allCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="WiFi Password"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={6}
                  placeholder="Network: HomeWiFi-5G, Password: ..."
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              {currentSection && (
                <button
                  onClick={handleDelete}
                  className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!formData.title.trim() || !formData.content.trim()}
                className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-secondary disabled:opacity-50"
              >
                <Save size={18} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseholdInfo;