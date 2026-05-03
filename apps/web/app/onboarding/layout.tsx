export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Logo */}
      <header className="px-8 py-5">
        <span className="font-semibold text-base tracking-tight text-text-primary">syntra</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
