"use client";
import { useEffect, useState } from "react";
export function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem("miftan-favorites") || "[]")
      .filter((v: unknown) => typeof v === "string")
      .slice(0, 100);
  } catch {
    return [];
  }
}
export default function Favorite({ id }: { id: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(readFavorites().includes(id));
  }, [id]);
  function toggle() {
    const all = readFavorites();
    const next = saved
      ? all.filter((x) => x !== id)
      : [id, ...all].slice(0, 100);
    localStorage.setItem("miftan-favorites", JSON.stringify(next));
    setSaved(!saved);
    window.dispatchEvent(new Event("favorites-change"));
  }
  return (
    <button
      className={"favorite " + (saved ? "saved" : "")}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "הסרה מהשמורים" : "שמירת הבית"}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
