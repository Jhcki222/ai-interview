"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Bookmark,
  ChevronRight,
  Command,
  FileText,
  FolderHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  Target,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
const mainLinks = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/questions", label: "질문 학습", icon: BookOpen },
  { href: "/interview", label: "AI 모의면접", icon: AudioLines, badge: "Beta" },
];
const personalLinks = [
  { href: "/my/questions", label: "내가 만든 질문", icon: FolderHeart },
  { href: "/my/answers", label: "작성한 답변", icon: FileText },
  { href: "/my/bookmarks", label: "북마크", icon: Bookmark },
  { href: "/my/progress", label: "학습 현황", icon: Target },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [authError, setAuthError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { user, loading, signOut } = useAuth();
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const field = document.getElementById("question-search");
        if (field) field.focus();
        else router.push("/questions");
      }
    };
    document.addEventListener("keydown", search);
    return () => document.removeEventListener("keydown", search);
  }, [router]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [],
      ).filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = previousOverflow;
      menuRef.current?.focus();
    };
  }, [mobileOpen]);
  const active = (href: string) => (href === "/" ? pathname === href : pathname.startsWith(href));
  const current = [
    ...mainLinks,
    ...personalLinks,
    { href: "/settings", label: "설정" },
    { href: "/login", label: "로그인" },
    { href: "/signup", label: "회원가입" },
  ].find((link) => active(link.href));
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="app-navigation"
        ref={sidebarRef}
        className={cn("app-sidebar", mobileOpen && "is-open")}
        aria-label="메인 탐색"
      >
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <AudioLines size={23} strokeWidth={2.3} />
          </span>
          <span>
            interview<span className="brand-dot">.</span>ai
          </span>
        </Link>
        <button
          className="mobile-close btn btn-ghost btn-icon"
          onClick={() => setMobileOpen(false)}
          aria-label="메뉴 닫기"
        >
          <X size={20} />
        </button>
        <Link href="/questions" className="sidebar-search">
          <Search size={16} />
          <span>질문 찾아보기</span>
          <span className="search-shortcut">
            <Command size={11} /> K
          </span>
        </Link>
        <div className="nav-group">
          <p className="nav-caption">WORKSPACE</p>
          <nav>
            {mainLinks.map(({ href, label, icon: Icon, badge }) => (
              <Link
                key={href}
                href={href}
                className={cn("nav-link", active(href) && "active")}
                aria-current={active(href) ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
                {badge && <span className="nav-badge">{badge}</span>}
                {active(href) && <span className="nav-active-dot" />}
              </Link>
            ))}
          </nav>
        </div>
        <div className="nav-group">
          <p className="nav-caption">MY LIBRARY</p>
          <nav>
            {personalLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn("nav-link", active(href) && "active")}
                aria-current={active(href) ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="nav-group topic-shortcuts">
          <p className="nav-caption">QUICK TOPICS</p>
          <Link href="/questions?category=CS" className="topic-shortcut">
            <span className="topic-dot dot-violet" />
            CS 기초
            <ChevronRight size={13} />
          </Link>
          <Link href="/questions?category=FRONTEND" className="topic-shortcut">
            <span className="topic-dot dot-teal" />
            프런트엔드
            <ChevronRight size={13} />
          </Link>
          <Link href="/questions?category=BACKEND" className="topic-shortcut">
            <span className="topic-dot dot-blue" />
            백엔드 개발
            <ChevronRight size={13} />
          </Link>
          <Link href="/questions?category=AI" className="topic-shortcut">
            <span className="topic-dot dot-green" />
            AI 엔지니어링
            <ChevronRight size={13} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link href="/settings" className={cn("nav-link", active("/settings") && "active")}>
            <Settings2 size={18} />
            <span>설정</span>
          </Link>
        </div>
      </aside>
      <div className="app-workspace" inert={mobileOpen}>
        <header className="app-topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="btn btn-ghost btn-icon mobile-menu"
              aria-expanded={mobileOpen}
              aria-controls="app-navigation"
              aria-label="탐색 메뉴 열기"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-workspace">내 워크스페이스</span>
            <ChevronRight size={13} />
            <span>{current?.label ?? "면접 준비"}</span>
          </div>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="테마 변경"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {mounted && resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <span className="topbar-divider" />
            {loading ? (
              <span className="avatar-skeleton" />
            ) : user ? (
              <>
                <Link className="user-chip" href="/my/progress">
                  <span className="avatar">
                    {(user.nickname || user.email || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <span>{user.nickname || "내 계정"}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="로그아웃"
                  onClick={() => {
                    setAuthError("");
                    void signOut()
                      .then(() => {
                        router.replace("/");
                        router.refresh();
                      })
                      .catch(() => setAuthError("로그아웃에 실패했어요. 다시 시도해 주세요."));
                  }}
                >
                  <LogOut size={16} />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="login-link">
                  로그인
                </Link>
                <Button asChild size="sm">
                  <Link href="/signup">
                    무료로 시작하기 <ArrowUpRight size={14} />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </header>
        <main id="main-content" className="main-content">
          {authError && (
            <p className="learning-alert learning-error" role="alert">
              {authError}
            </p>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} interview.ai</span>
        </footer>
      </div>
    </div>
  );
}
