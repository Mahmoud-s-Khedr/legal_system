import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTopButton({
  label,
  threshold = 320,
  scrollContainerId
}: {
  label: string;
  threshold?: number;
  scrollContainerId?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = scrollContainerId ? document.getElementById(scrollContainerId) : null;
    const scrollTarget = container ?? window;

    const getScrollTop = () =>
      container ? container.scrollTop : window.scrollY;

    function onScroll() {
      setVisible(getScrollTop() > threshold);
    }

    onScroll();
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", onScroll);
  }, [scrollContainerId, threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const container = scrollContainerId ? document.getElementById(scrollContainerId) : null;
        if (container) {
          container.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="fixed bottom-[calc(var(--footer-height)+1rem)] end-5 z-30 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-card transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={label}
      title={label}
    >
      <ArrowUp size={14} />
      <span>{label}</span>
    </button>
  );
}
