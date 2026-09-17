"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

type Session = { role?: string; status?: string };
function canCreate(session: Session | null) {
  return !!session && (["admin", "platform_admin", "org_admin"].includes(session.role ?? "") || (["organizer", "event_owner"].includes(session.role ?? "") && session.status === "approved"));
}

export default function CreateEventLink({ children, href = "/events/create", className, style }: { children: ReactNode; href?: string; className?: string; style?: React.CSSProperties }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json();
        setAllowed(Boolean(response.ok && data.authenticated && canCreate(data.session as Session | null)));
      } catch {
        setAllowed(false);
      }
    };
    void sync();
    window.addEventListener("storage", sync);
    window.addEventListener("ueb:session-changed", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("ueb:session-changed", sync); };
  }, []);
  return allowed ? <Link href={href} className={className} style={style}>{children}</Link> : null;
}
