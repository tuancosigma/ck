import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="relative flex-1 overflow-x-hidden px-6 py-8 sm:px-10">
        {/* Theme toggle pinned to the top-right of the navigation shell */}
        <div className="absolute right-6 top-6 z-40 sm:right-10">
          <ThemeToggle />
        </div>
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
