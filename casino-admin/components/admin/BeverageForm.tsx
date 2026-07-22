"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ALL_CATEGORIES, CATEGORY_META, type Beverage, type BeverageCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { uploadBeverageImage } from "@/lib/storage";

interface BeverageFormProps {
  initial?: Beverage;
  onSubmit: (data: Omit<Beverage, "id" | "ordersTotal" | "createdAt">) => void;
  onCancel: () => void;
}

const EMPTY: Omit<Beverage, "id" | "ordersTotal" | "createdAt"> = {
  name: "", description: "", category: "cocktail", emoji: "🍸",
  imageUrl: null,
  price: 0, isAlcoholic: true, isAvailable: true, isFeatured: false,
  prepMinutes: 5, tags: [],
};

const EMOJI_DEFAULTS: Record<BeverageCategory, string> = {
  cocktail: "🍸", champagne: "🍾", spirit: "🥃",
  wine: "🍷", beer: "🍺", shot: "⚡", "non-alcoholic": "💧",
};

export function BeverageForm({ initial, onSubmit, onCancel }: BeverageFormProps) {
  const [form,     setForm]     = useState<Omit<Beverage, "id" | "ordersTotal" | "createdAt">>(
    initial
      ? { name: initial.name, description: initial.description, category: initial.category,
          emoji: initial.emoji, imageUrl: initial.imageUrl ?? null, price: initial.price,
          isAlcoholic: initial.isAlcoholic,
          isAvailable: initial.isAvailable, isFeatured: initial.isFeatured,
          prepMinutes: initial.prepMinutes, tags: [...initial.tags] }
      : { ...EMPTY }
  );
  const [tagInput, setTagInput] = useState("");
  const [errors,   setErrors]   = useState<Partial<Record<keyof typeof form, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadBeverageImage(file);
      set("imageUrl", url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleCategory = (cat: BeverageCategory) => {
    if (cat === form.category) return; // re-clicking the active category must not touch the emoji
    setForm(f => ({
      ...f,
      category: cat,
      // Only swap in the new category's default emoji if the admin hasn't
      // already customized it away from the previous category's default —
      // otherwise a custom emoji (e.g. Diet Coke's 🥤) gets silently wiped.
      emoji: f.emoji === EMOJI_DEFAULTS[f.category] ? EMOJI_DEFAULTS[cat] : f.emoji,
      isAlcoholic: cat === "non-alcoholic" ? false : true,
    }));
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim())     e.name  = "Name is required";
    // $0 is valid — event drinks are free (Giant upcharge / surcharge handled
    // elsewhere). Only a negative price is rejected.
    if (form.price < 0)        e.price = "Price can't be negative";
    if (form.prepMinutes <= 0) e.prepMinutes = "Prep time must be at least 1 minute";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(form);
  };

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="field-label">Beverage Name <span className="text-red-400">*</span></label>
        <input
          value={form.name}
          onChange={e => { set("name", e.target.value); setErrors(p => ({ ...p, name: "" })); }}
          placeholder="e.g. Royal Flush"
          className={cn("field-input", errors.name && "border-red-500/50 focus:border-red-500/70")}
        />
        {errors.name && <p className="text-red-400 text-xs font-body mt-1">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="field-label">Description</label>
        <textarea
          rows={2}
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Short tasting note or description shown to guests…"
          className="field-input resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="field-label">Category</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map(cat => {
            const meta  = CATEGORY_META[cat];
            const active = form.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategory(cat)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body font-medium border transition-all",
                  active
                    ? `${meta.color} font-semibold`
                    : "bg-raised border-edge text-ink-400 hover:text-white",
                )}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price + Prep time + Emoji */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="field-label">Price (USD) <span className="text-red-400">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 font-mono text-sm">$</span>
            <input
              type="number"
              min={0}
              step={0.50}
              value={form.price || ""}
              onChange={e => { set("price", parseFloat(e.target.value) || 0); setErrors(p => ({ ...p, price: "" })); }}
              placeholder="0.00"
              className={cn("field-input pl-7", errors.price && "border-red-500/50")}
            />
          </div>
          {errors.price && <p className="text-red-400 text-xs font-body mt-1">{errors.price}</p>}
        </div>
        <div>
          <label className="field-label">Prep (mins)</label>
          <input
            type="number"
            min={1} max={60}
            value={form.prepMinutes}
            onChange={e => set("prepMinutes", parseInt(e.target.value) || 1)}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Emoji</label>
          <input
            value={form.emoji}
            onChange={e => set("emoji", e.target.value)}
            onBlur={() => set("emoji", form.emoji.trim())}
            className="field-input text-2xl text-center"
            maxLength={8}
          />
        </div>
      </div>

      {/* Photo */}
      <div>
        <label className="field-label">Photo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-raised border border-edge flex items-center justify-center flex-shrink-0">
            {form.imageUrl
              ? <img src={form.imageUrl} alt={form.name || "Beverage preview"} className="w-full h-full object-cover" />
              : <span className="text-3xl select-none">{form.emoji}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <label className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-body font-medium border cursor-pointer transition-all",
              uploading
                ? "bg-raised border-edge text-ink-400 cursor-not-allowed"
                : "bg-surface border-edge text-ink-300 hover:text-white hover:border-rim",
            )}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {uploading ? "Uploading…" : form.imageUrl ? "Replace photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {form.imageUrl && !uploading && (
              <button
                type="button"
                onClick={() => set("imageUrl", null)}
                className="ml-2 text-xs font-body text-ink-400 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
            <p className="text-[11px] text-ink-400 font-body mt-1.5">
              Falls back to the emoji above when no photo is set.
            </p>
            {uploadError && <p className="text-red-400 text-xs font-body mt-1">{uploadError}</p>}
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-3 gap-3">
        {([
          ["isAlcoholic", "Alcoholic"],
          ["isAvailable", "Available"],
          ["isFeatured",  "Featured"],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2.5 cursor-pointer">
            <div
              role="switch"
              aria-checked={form[key]}
              tabIndex={0}
              onClick={() => set(key, !form[key])}
              onKeyDown={e => e.key === " " && set(key, !form[key])}
              className={cn(
                "w-10 h-5 rounded-full relative flex-shrink-0 cursor-pointer transition-colors duration-200",
                form[key] ? "bg-felt-500" : "bg-rim",
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200",
                form[key] ? "translate-x-5" : "translate-x-0.5",
              )} />
            </div>
            <span className="text-sm text-ink-200 font-body select-none">{label}</span>
          </label>
        ))}
      </div>

      {/* Tags */}
      <div>
        <label className="field-label">Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Type tag and press Enter…"
            className="field-input flex-1"
          />
          <Button variant="surface" size="sm" onClick={addTag}>Add</Button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set("tags", form.tags.filter(x => x !== t))}
                aria-label={`Remove tag ${t}`}
                title={`Remove tag ${t}`}
                className="text-[11px] font-mono bg-raised border border-edge text-ink-300 px-2 py-1.5 rounded-full hover:bg-red-600/15 hover:text-red-400 hover:border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-colors"
              >
                {t} ×
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-edge">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="gold" onClick={handleSubmit} disabled={uploading} icon={<span>{initial ? "💾" : "✦"}</span>}>
          {uploading ? "Uploading photo…" : initial ? "Save Changes" : "Add Beverage"}
        </Button>
      </div>
    </div>
  );
}
