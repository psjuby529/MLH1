"use client";

function clearSiteDataAndReload() {
  if (typeof window === "undefined") return;
  if (!confirm("確定要清除本站快取並重新載入？可解決「題庫載入失敗」或資料不同步。")) return;
  Promise.all([
    typeof caches !== "undefined" ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) : Promise.resolve(),
    typeof navigator !== "undefined" && navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))) : Promise.resolve(),
  ]).finally(() => {
    window.location.reload();
  });
}

export default function Footer() {
  return (
    <footer className="py-4 text-center text-gray-400 text-xs">
      MLH Quiz v1.2.2
      {" · "}
      <button type="button" onClick={clearSiteDataAndReload} className="underline hover:text-gray-600">
        資料更新
      </button>
    </footer>
  );
}
