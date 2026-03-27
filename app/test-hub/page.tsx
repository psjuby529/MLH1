import Link from "next/link";

export default function TestHubPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-[#111] px-4 py-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center mb-2">測試入口</h1>
        <p className="text-sm text-neutral-600 text-center mb-6">今天內測：請先選擇單選或複選</p>

        <div className="space-y-4">
          <Link
            href="/quiz"
            className="block w-full rounded-2xl bg-[#111] text-white text-center text-lg font-semibold py-5 min-h-[56px]"
          >
            單選題測試
          </Link>

          <Link
            href="/multi-test"
            className="block w-full rounded-2xl border-2 border-[#111] bg-white text-[#111] text-center text-lg font-semibold py-5 min-h-[56px]"
          >
            複選題測試
          </Link>
        </div>
      </div>
    </main>
  );
}
