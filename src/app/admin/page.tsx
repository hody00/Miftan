import { admin } from "@/lib/auth";
import Admin from "@/components/Admin";
import Login from "@/components/Login";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await admin();
  return (
    <div className="content page-content">
      <span className="eyebrow">מפתן · מאחורי הקלעים</span>
      <h1>{user ? "ניהול הבית" : "ברוכים השבים"}</h1>
      {user ? <Admin /> : <Login />}
    </div>
  );
}
