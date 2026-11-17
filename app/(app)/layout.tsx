import { requireUser } from "@/lib/auth";
import { Sidebar, MobileNav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      <Sidebar userName={user.name} role={user.role} />
      <div className="min-w-0">
        <MobileNav />
        <div className="app-content mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
