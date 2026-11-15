"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/products", label: "Products", icon: "box" },
  { href: "/movements", label: "Movements", icon: "swap" },
  { href: "/suppliers", label: "Suppliers", icon: "truck" },
  { href: "/reorder", label: "Reorder", icon: "alert" },
  { href: "/reports", label: "Reports", icon: "chart" },
  { href: "/settings", label: "Settings", icon: "cog" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    box: "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3zm0 0 9 4.5M12 3 3 7.5M12 21v-9m9-4.5L12 12 3 7.5",
    swap: "M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3",
    truck: "M3 7h10v9H3zM13 10h4l4 4v2h-8zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    alert: "M12 4 2.5 20h19L12 4zm0 5v6m0 3v.5",
    chart: "M4 20V9m5 11V4m5 16v-7m5 7V7",
    cog: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm8-3.5-.2 1.6 1.7 1.3-1.6 2.8-2-.7-1.3 1-.3 2.1h-3.2l-.3-2.1-1.3-1-2 .7-1.6-2.8 1.7-1.3L9.4 12l.2-1.6-1.7-1.3 1.6-2.8 2 .7 1.3-1 .3-2.1h3.2l.3 2.1 1.3 1 2-.7 1.6 2.8-1.7 1.3z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}

export function Sidebar({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-[#0a0c10] lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-[13px] font-bold text-white">
          Z
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">StockFlow</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Zeroth</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand/12 font-semibold text-white ring-1 ring-inset ring-brand/30"
                  : "text-muted hover:bg-panel2 hover:text-silver"
              }`}
            >
              <span className={active ? "text-[#7b9bff]" : ""}>
                <Icon name={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-panel2 text-xs font-semibold text-silver ring-1 ring-inset ring-line">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-silver">{userName}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">{role}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button className="btn-ghost btn-sm w-full" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-[#0a0c10] px-3 py-2 lg:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active ? "bg-brand/15 text-white ring-1 ring-inset ring-brand/30" : "text-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
