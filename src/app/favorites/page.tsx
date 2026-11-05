"use client";
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { readFavorites } from "@/components/Favorite";
import type { Listing } from "@/lib/listings";
import Link from "next/link";
export default function Favorites() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    async function load() {
      const ids = readFavorites();
      if (!ids.length) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        const r = await fetch("/api/listings?ids=" + ids.join(","));
        if (!r.ok) throw Error();
        const first=await r.json();
        const pages=await Promise.all(Array.from({length:Math.max(0,first.pages-1)},async(_,i)=>{const response=await fetch('/api/listings?ids='+ids.join(',')+'&page='+(i+2));if(!response.ok)throw Error();return (await response.json()).items as Listing[];}));
        setItems([...first.items,...pages.flat()]);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
    window.addEventListener("favorites-change", load);
    return () => window.removeEventListener("favorites-change", load);
  }, []);
  return (
    <div className="content page-content">
      <span className="eyebrow">המקומות שעשו לכם משהו</span>
      <h1>הבתים ששמרתי</h1>
      <p className="muted">
        השמורים נשמרים בדפדפן הזה. מודעות שהוסרו או פג תוקפן אינן מוצגות.
      </p>
      {loading ? (
        <p role="status">טוענים את הבתים שלכם…</p>
      ) : error ? (
        <p role="alert">לא הצלחנו לטעון את השמורים. נסו לרענן את העמוד.</p>
      ) : items.length ? (
        <div className="listing-grid">
          {items.map((l) => (
            <Card listing={l} key={l.id} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">♡</div>
          <h2>מקום לבתים שאהבתם</h2>
          <p>לחצו על הלב לצד כל בית כדי לחזור אליו בקלות.</p>
          <Link href="/" className="button">
            לגלות בתים
          </Link>
        </div>
      )}
    </div>
  );
}
