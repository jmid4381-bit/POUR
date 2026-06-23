"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  Plus, Search, Pencil, Trash2, X, Check,
  ChevronDown, Star, Clock, TrendingUp, Wine,
  PackageCheck, PackageX, Filter,
} from "lucide-react";
import { useStore }        from "@/lib/store";
import { BeverageForm }    from "@/components/admin/BeverageForm";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Button }          from "@/components/ui/Button";
import { cn, fmtUSD }      from "@/lib/utils";
import { ALL_CATEGORIES, CATEGORY_META, type Beverage, type BeverageCategory } from "@/lib/types";

// ─── Inline price editor ──────────────────────────────────────────────────────

function PriceCell({ beverage, onSave }: { beverage: Beverage; onSave: (price: number) => void }) {
  const [editing, setEditing]   = useState(false);
  const [value,   setValue]     = useState(beverage.price.toFixed(2));
  const [flashing,setFlashing]  = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    setValue(beverage.price.toFixed(2));
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const commit = () => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed !== beverage.price) {
      onSave(Math.round(parsed * 100) / 100);
      setFlashing(true);
      setTimeout(() => setFlashing(false), 1400);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
    setValue(beverage.price.toFixed(2));
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-ink-400 font-mono text-sm">$</span>
        <input
          ref={inputRef}
          type="number"
          min={0.01}
          step={0.50}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          onBlur={commit}
          autoFocus
          className="w-20 bg-raised border border-gold-500/50 rounded-lg px-2 py-1 text-sm font-mono text-white focus:outline-none shadow-price-active"
        />
        <button onClick={commit}  className="text-felt-400 hover:text-felt-300 transition-colors"><Check size={13} /></button>
        <button onClick={cancel}  className="text-ink-500 hover:text-red-400 transition-colors"><X size={13} /></button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      title="Click to edit price"
      className={cn(
        "group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-200",
        flashing
          ? "animate-gold-flash border-gold-500/40 bg-gold-500/15"
          : "border-transparent hover:border-gold-500/30 hover:bg-gold-500/8",
      )}
    >
      <span className="font-mono text-sm font-semibold text-white">{fmtUSD(beverage.price)}</span>
      <Pencil size={10} className="text-ink-600 group-hover:text-gold-400 transition-colors" />
    </button>
  );
}

// ─── Availability toggle ──────────────────────────────────────────────────────

function AvailabilityToggle({ beverage, onToggle }: { beverage: Beverage; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold uppercase tracking-wide transition-all duration-200",
        beverage.isAvailable
          ? "text-felt-400 bg-felt-500/8 border-felt-500/20 hover:bg-felt-500/15"
          : "text-red-400   bg-red-500/8  border-red-500/20  hover:bg-red-500/15",
      )}
    >
      {beverage.isAvailable
        ? <><PackageCheck size={11} />Active</>
        : <><PackageX size={11} />Off Menu</>
      }
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BeveragesPage() {
  const { state, loading, addBeverage, updateBeverage, deleteBeverage, updatePrice, toggleAvailable } = useStore();

  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState<BeverageCategory | "all">("all");
  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState<Beverage | null>(null);
  const [deleting,   setDeleting]   = useState<Beverage | null>(null);
  const [sortField,  setSortField]  = useState<"name" | "price" | "ordersTotal">("ordersTotal");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc");

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let list = [...state.beverages];
    if (catFilter !== "all") list = list.filter(b => b.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q) ||
        b.tags.some(t => (t ?? "").toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "name")        return a.name.localeCompare(b.name) * mul;
      if (sortField === "price")       return (a.price - b.price) * mul;
      if (sortField === "ordersTotal") return (a.ordersTotal - b.ordersTotal) * mul;
      return 0;
    });
    return list;
  }, [state.beverages, catFilter, search, sortField, sortDir]);

  // Stats
  const totalRevenue = useMemo(() =>
    state.orders.filter(o => o.status === "delivered").reduce((s, o) => s + o.revenue, 0),
    [state.orders]
  );
  const availableCount   = state.beverages.filter(b => b.isAvailable).length;
  const unavailableCount = state.beverages.length - availableCount;
  const avgPrice         = state.beverages.length
    ? state.beverages.reduce((s, b) => s + b.price, 0) / state.beverages.length
    : 0;

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <ChevronDown
      size={12}
      className={cn(
        "transition-transform",
        sortField === field && sortDir === "asc" && "rotate-180",
        sortField !== field && "opacity-30",
      )}
    />
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-500 font-mono text-sm animate-pulse">Loading beverage menu…</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-base/95 backdrop-blur-xl border-b border-edge px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">Beverage Menu</h1>
            <p className="text-xs text-ink-500 font-mono mt-0.5">
              {state.beverages.length} items · {availableCount} active
            </p>
          </div>
          <Button
            variant="gold"
            icon={<Plus size={15} />}
            onClick={() => setShowAdd(true)}
          >
            Add Beverage
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total SKUs",   value: state.beverages.length, icon: Wine,         color: "text-gold-400",  top: "bg-gold-gradient"  },
            { label: "Active",       value: availableCount,          icon: PackageCheck, color: "text-felt-400",  top: "bg-felt-gradient"  },
            { label: "Off Menu",     value: unavailableCount,        icon: PackageX,     color: "text-red-400",   top: "bg-red-500"        },
            { label: "Avg Price",    value: fmtUSD(avgPrice),        icon: TrendingUp,   color: "text-gold-300",  top: "bg-gold-gradient"  },
          ].map(({ label, value, icon: Icon, color, top }) => (
            <div key={label} className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
              <div className={cn("h-0.5 w-full", top)} />
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono text-ink-500 uppercase tracking-widest mb-1">{label}</p>
                  <p className={cn("font-mono font-bold text-2xl leading-none", color)}>{value}</p>
                </div>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color, "bg-current/10 border border-current/20")}>
                  <Icon size={16} className={color} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Controls ── */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search beverages…"
              className="field-input pl-9 w-full"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter("all")}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-body font-medium border transition-all",
                catFilter === "all"
                  ? "bg-gold-500/10 border-gold-500/20 text-gold-300"
                  : "bg-surface border-edge text-ink-400 hover:text-white",
              )}
            >
              All
            </button>
            {ALL_CATEGORIES.map(cat => {
              const m = CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-body font-medium border transition-all",
                    catFilter === cat ? `${m.color}` : "bg-surface border-edge text-ink-400 hover:text-white",
                  )}
                >
                  {m.emoji} {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-edge overflow-hidden bg-surface shadow-card">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-0 border-b border-edge bg-raised/50">
            {[
              { label: "Beverage",   field: "name"        as const, cl: "pl-4" },
              { label: "Category",   field: null,                    cl: ""     },
              { label: "Price",      field: "price"       as const, cl: ""     },
              { label: "Popularity", field: "ordersTotal" as const, cl: ""     },
              { label: "Status",     field: null,                    cl: ""     },
              { label: "",           field: null,                    cl: "pr-4" },
            ].map(({ label, field, cl }) => (
              <div
                key={label}
                onClick={field ? () => toggleSort(field) : undefined}
                className={cn(
                  "px-3 py-3 text-[10px] font-mono text-ink-500 uppercase tracking-widest flex items-center gap-1",
                  field && "cursor-pointer hover:text-ink-200 transition-colors select-none",
                  cl,
                )}
              >
                {label}
                {field && <SortIcon field={field} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length > 0 ? (
            <div className="divide-y divide-edge/60">
              {filtered.map((bev, i) => {
                const catMeta = CATEGORY_META[bev.category];
                return (
                  <div
                    key={bev.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-0 items-center hover:bg-raised/40 transition-colors group animate-row-in"
                    style={{ animationDelay: `${i * 25}ms` }}
                  >
                    {/* Name */}
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-raised flex items-center justify-center flex-shrink-0">
                        {bev.imageUrl
                          ? <img src={bev.imageUrl} alt={bev.name} loading="lazy" className="w-full h-full object-cover" />
                          : <span className="text-2xl select-none">{bev.emoji}</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white font-body font-medium text-sm leading-tight truncate">{bev.name}</p>
                          {bev.isFeatured && <Star size={11} className="text-gold-400 fill-gold-400 flex-shrink-0" />}
                        </div>
                        <p className="text-ink-500 text-xs font-body truncate mt-0.5 max-w-[200px]">{bev.description}</p>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="px-3 py-3.5">
                      <span className={cn("text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border", catMeta.color)}>
                        {catMeta.label}
                      </span>
                    </div>

                    {/* Price — inline editable */}
                    <div className="px-3 py-3.5">
                      <PriceCell
                        beverage={bev}
                        onSave={price => updatePrice(bev.id, price)}
                      />
                    </div>

                    {/* Popularity */}
                    <div className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 max-w-[60px] h-1.5 bg-rim rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold-gradient rounded-full"
                            style={{ width: `${Math.min(100, (bev.ordersTotal / 350) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-ink-400">{bev.ordersTotal}</span>
                      </div>
                    </div>

                    {/* Availability */}
                    <div className="px-3 py-3.5">
                      <AvailabilityToggle
                        beverage={bev}
                        onToggle={() => toggleAvailable(bev.id)}
                      />
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="surface"
                          size="xs"
                          icon={<Pencil size={11} />}
                          onClick={() => setEditing(bev)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          icon={<Trash2 size={11} />}
                          onClick={() => setDeleting(bev)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center">
              <Wine size={32} className="text-ink-700 mx-auto mb-3" />
              <p className="text-ink-500 font-body text-sm">No beverages match your search</p>
              {(search || catFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setCatFilter("all"); }}
                  className="mt-2 text-gold-400 text-xs font-body hover:text-gold-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Price edit hint */}
        <p className="text-center text-[11px] text-ink-600 font-body">
          💡 Click any price in the table to edit it inline — press Enter to save
        </p>
      </div>

      {/* ── Add Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Beverage" subtitle="New item will appear on the guest ordering menu immediately" size="md">
        <BeverageForm
          onSubmit={data => { addBeverage(data); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit: ${editing?.name ?? ""}`} subtitle="Changes apply to the guest menu immediately" size="md">
        {editing && (
          <BeverageForm
            initial={editing}
            onSubmit={data => { updateBeverage({ ...editing, ...data }); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleting}
        title={`Remove "${deleting?.name ?? ""}"?`}
        message="This will permanently remove the beverage from the menu. Historical orders referencing this item will be preserved in your order history."
        confirmLabel="Remove Beverage"
        onConfirm={() => { if (deleting) { deleteBeverage(deleting.id); setDeleting(null); } }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
