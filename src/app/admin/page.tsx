import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import content from "@/data/content.json";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return <AdminDashboard initialContent={content} />;
}
