import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { BottomNav } from "@/components/layout/BottomNav";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { AutoDriveBackup } from "@/components/backup/AutoDriveBackup";
import { isDemoMode } from "@/lib/auth";

// Auth and demo mode are decided per request from runtime env, never at build time.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SplashScreen />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {isDemoMode() && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-200">
            Demo mode: sign-in is disabled and Google features are off. Do not expose this instance to the internet.
          </div>
        )}
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
      {process.env.ENABLE_DRIVE_AUTO_BACKUP === "true" && <AutoDriveBackup />}
    </div>
  );
}
