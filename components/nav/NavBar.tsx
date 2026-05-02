"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, BookOpen, User } from "lucide-react";

interface Props {
  user: { name: string; email: string };
  reviewName?: string;
  reviewId?: string;
}

export default function NavBar({ user, reviewName, reviewId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = user.name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();

  return (
    <nav className="h-[52px] flex items-center px-6 gap-4" style={{background:"#1A2744"}}>
      <Link href="/reviews" className="text-white font-bold text-[17px] tracking-tight hover:opacity-90">
        Lumina Review
      </Link>

      {reviewName && reviewId && (
        <>
          <span className="text-white/40 text-sm">/</span>
          <span className="text-white/80 text-sm bg-white/10 px-3 py-0.5 rounded-md">
            {reviewName}
          </span>
          <div className="hidden md:flex items-center gap-1 ml-2">
            {[
              { href: `/reviews/${reviewId}`, label: "Summary" },
              { href: `/reviews/${reviewId}/screening`, label: "Screening" },
              { href: `/reviews/${reviewId}/fulltext`, label: "Full Text" },
              { href: `/reviews/${reviewId}/extraction`, label: "Extraction" },
            ].map(link => (
              <Link key={link.href} href={link.href}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  pathname === link.href
                    ? "bg-white/20 text-white font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}>
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <Link href="/reviews" className="text-white/60 hover:text-white transition-colors">
          <BookOpen size={16} />
        </Link>
        <div className="w-[30px] h-[30px] rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center cursor-pointer"
          title={user.name}>
          {initials}
        </div>
        <button onClick={signOut} className="text-white/60 hover:text-white transition-colors" title="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  );
}
