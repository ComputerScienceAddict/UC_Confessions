import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[#2d4373] bg-[#3b5998] shadow-sm">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="min-w-0 truncate text-white no-underline hover:opacity-90"
          style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <span className="text-[20px] font-bold leading-none tracking-tight text-white">
            [uc-confessions]
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="flex shrink-0 items-center gap-4 text-[13px]"
          style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <a
            href="#post"
            className="text-white/95 hover:text-white hover:underline"
          >
            Post
          </a>
        </nav>
      </div>
    </header>
  );
}

