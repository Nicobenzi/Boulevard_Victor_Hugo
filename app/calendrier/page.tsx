"use client";
import { useEffect, useState } from "react";
import { supabase, PLATFORMS, STATUS_FR } from "@/lib/supabase";

export default function Calendrier() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [pubs, setPubs] = useState<any[]>([]);
  const [poems, setPoems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ poem_id: "", platform: "instagram", date: "", time: "18:00", caption: "" });

  async function load() {
    const start = month.toISOString();
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
    const { data } = await supabase.from("publications")
      .select("id, platform, scheduled_at, status, poems(title)")
      .gte("scheduled_at", start).lt("scheduled_at", end).neq("status", "cancelled")
      .order("scheduled_at");
    setPubs(data ?? []);
    const { data: p } = await supabase.from("poems").select("id, title, author").order("created_at", { ascending: false });
    setPoems(p ?? []);
  }
  useEffect(() => { load(); }, [month]);

  const firstDay = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => (i < firstDay ? null : i - firstDay + 1));
  const monthName = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  async function createPub(e: any) {
    e.preventDefault();
    const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("publications").insert({ poem_id: form.poem_id, platform: form.platform, scheduled_at, caption: form.caption, created_by: user?.id });
    setShowForm(false); setForm({ ...form, caption: "" }); load();
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="font-serif2 text-3xl capitalize">{monthName}</h1>
        <button className="btn2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <button className="btn2" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        <button className="btn ml-auto" onClick={() => setShowForm(!showForm)}>+ Programmer</button>
      </div>

      {showForm && (
        <form onSubmit={createPub} className="card mb-6 grid gap-3 md:grid-cols-2">
          <div><div className="label mb-1">Poème</div>
            <select required value={form.poem_id} onChange={(e) => setForm({ ...form, poem_id: e.target.value })}>
              <option value="">— choisir —</option>
              {poems.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.author}</option>)}
            </select></div>
          <div><div className="label mb-1">Plateforme</div>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select></div>
          <div><div className="label mb-1">Date</div><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><div className="label mb-1">Heure</div><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div className="md:col-span-2"><div className="label mb-1">Caption (modifiable ensuite)</div>
            <textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></div>
          <button className="btn md:col-span-2">Programmer</button>
        </form>
      )}

      <div className="grid grid-cols-7 gap-px text-xs mb-1" style={{ color: "var(--ink-dim)" }}>
        {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => <div key={d} className="p-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: "var(--line)", border: "1px solid var(--line)" }}>
        {cells.map((day, i) => {
          const dayPubs = day ? pubs.filter((p) => new Date(p.scheduled_at).getDate() === day) : [];
          return (
            <div key={i} className="min-h-20 p-1.5" style={{ background: "var(--panel)" }}>
              {day && <div className="text-xs mb-1" style={{ color: "var(--ink-dim)" }}>{day}</div>}
              {dayPubs.map((p) => (
                <div key={p.id} className="rounded px-1.5 py-0.5 mb-1 text-[10px] leading-tight"
                  style={{ background: PLATFORMS[p.platform].color + (p.status === "published" ? "55" : "22"), color: "var(--ink)", borderLeft: `2px solid ${PLATFORMS[p.platform].color}` }}
                  title={`${p.poems?.title} — ${STATUS_FR[p.status]}`}>
                  {PLATFORMS[p.platform].short} · {p.poems?.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
