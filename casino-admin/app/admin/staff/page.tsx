"use client";

import { useState, useMemo } from "react";
import { Users, Trophy, Clock, DollarSign, TrendingUp } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { MetricCard }   from "@/components/admin/MetricCard";
import { useStore }     from "@/lib/store";
import { cn, fmtUSD, fmtDateTime, minutesBetween } from "@/lib/utils";
import { STATUS_META }  from "@/lib/types";

export default function StaffPage() {
  const a = useAnalytics();
  const { state, loading } = useStore();
  const [selected, setSelected] = useState<string | null>(null);

  // Orders for selected staff member
  const staffOrders = useMemo(() => {
    if (!selected) return [];
    return state.orders
      .filter(o => o.staffName === selected)
      .sort((a,b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
  }, [state.orders, selected]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-500 font-mono text-sm animate-pulse">Loading staff data…</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-base/96 backdrop-blur-xl border-b border-edge px-6 py-4">
        <div className="flex items-center gap-3">
          <Users size={18} className="text-felt-400" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">Staff Performance</h1>
            <p className="text-xs text-ink-500 font-mono mt-0.5">
              {a.staffPerformance.length} active staff · All-time data
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Active Staff"    value={a.staffPerformance.length}  sub="On record"         icon={Users}    accent="felt"  />
          <MetricCard label="Total Delivered" value={a.staffPerformance.reduce((s,s2)=>s+s2.orders,0)} sub="All time" icon={Trophy}   accent="gold"  />
          <MetricCard label="Avg Delivery"    value={`${a.avgWaitMinutes}m`}      sub="Today's average"   icon={Clock}    accent="blue"  />
          <MetricCard label="Total Revenue"   value={fmtUSD(a.staffPerformance.reduce((s,s2)=>s+s2.revenue,0))} sub="All staff" icon={DollarSign} accent="gold" />
        </div>

        {/* Staff table */}
        <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-edge flex items-center gap-2">
            <TrendingUp size={15} className="text-gold-400" />
            <h2 className="font-display font-semibold text-white text-base">Individual Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-edge bg-raised/40">
                  {["Rank","Staff Member","Orders","Revenue","Avg Delivery","Actions"].map((h, i) => (
                    <th key={h} className={cn("px-5 py-3 text-[10px] font-mono text-ink-500 uppercase tracking-widest text-left",
                      i === 5 && "text-right",
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.staffPerformance.length > 0 ? a.staffPerformance.map((staff, i) => (
                  <tr
                    key={staff.name}
                    className="border-b border-edge/40 last:border-0 hover:bg-raised/30 transition-colors cursor-pointer animate-row-in"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => setSelected(selected === staff.name ? null : staff.name)}
                  >
                    <td className="px-5 py-4">
                      <span className={cn("font-mono font-bold text-sm",
                        i === 0 ? "text-gold-300" : i === 1 ? "text-ink-300" : i === 2 ? "text-amber-600" : "text-ink-600",
                      )}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-void text-xs font-bold flex-shrink-0",
                          i === 0 ? "bg-gold-gradient" : "bg-ink-600/40 text-ink-300",
                        )}>
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white font-body font-medium text-sm leading-none">{staff.name}</p>
                          <p className="text-ink-600 text-[10px] font-mono mt-0.5">
                            {selected === staff.name ? "Click to collapse" : "Click to view orders"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-white text-lg">{staff.orders}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("font-mono font-semibold text-base", staff.revenue >= 500 ? "text-gold-300" : "text-white")}>
                        {fmtUSD(staff.revenue)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-mono text-sm", staff.avgWait <= 8 ? "text-felt-400" : staff.avgWait <= 12 ? "text-amber-400" : "text-red-400")}>
                          {staff.avgWait}m
                        </span>
                        {staff.avgWait <= 8 && <span className="text-[9px] text-felt-600 font-mono">Excellent</span>}
                        {staff.avgWait > 8 && staff.avgWait <= 12 && <span className="text-[9px] text-amber-600 font-mono">Good</span>}
                        {staff.avgWait > 12 && <span className="text-[9px] text-red-600 font-mono">Slow</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-[10px] font-mono text-felt-400 bg-felt-400/10 border border-felt-400/20 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Users size={28} className="text-ink-700 mx-auto mb-3" />
                      <p className="text-ink-500 font-body text-sm">No staff order data yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expanded staff order history */}
        {selected && staffOrders.length > 0 && (
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card animate-fade-up">
            <div className="px-5 py-4 border-b border-edge">
              <h3 className="font-display font-semibold text-white text-base">
                {selected} — Order History
              </h3>
              <p className="text-ink-500 text-xs font-mono mt-0.5">{staffOrders.length} orders</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-raised/30">
                    {["Order ID","Location","Items","Status","Delivery","Revenue"].map((h,i) => (
                      <th key={h} className={cn("px-4 py-3 text-[10px] font-mono text-ink-500 uppercase tracking-widest text-left", i===5 && "text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffOrders.slice(0, 20).map((order, i) => {
                    const meta = STATUS_META[order.status];
                    const wait = order.deliveredAt ? minutesBetween(order.placedAt, order.deliveredAt) : null;
                    return (
                      <tr key={order.id} className="border-b border-edge/40 last:border-0 hover:bg-raised/20 animate-row-in" style={{ animationDelay: `${i*20}ms` }}>
                        <td className="px-4 py-3 font-mono text-xs text-ink-400">{order.id}</td>
                        <td className="px-4 py-3 text-white text-sm font-body">{order.locationName}</td>
                        <td className="px-4 py-3 text-ink-400 text-xs font-body truncate max-w-[160px]">
                          {order.items.map(i => `${i.quantity}× ${i.beverageName}`).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border", meta.color)}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-400">
                          {wait !== null ? `${wait}m` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-white font-semibold">
                          {order.status === "cancelled" ? <span className="text-ink-600">—</span> : fmtUSD(order.revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
