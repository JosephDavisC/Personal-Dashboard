import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { UpcomingShifts } from "@/components/dashboard/UpcomingShifts";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { TodayEvents } from "@/components/dashboard/TodayEvents";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WeatherWidget } from "@/components/dashboard/WeatherWidget";
import { WeeklyHeatmap } from "@/components/dashboard/WeeklyHeatmap";
import { SiteHealthDots } from "@/components/dashboard/SiteHealthDots";
import { PaySummaryCard } from "@/components/dashboard/PaySummaryCard";
import { BackupStatusCard } from "@/components/dashboard/BackupStatusCard";
import { QuickLinks } from "@/components/links/QuickLinks";
import { JobFollowups } from "@/components/dashboard/JobFollowups";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0];
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <GreetingBanner name={firstName} />
        <QuickActions />
      </div>

      <QuickStats />

      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <UpcomingShifts />
          <TodayEvents />
          <UpcomingTasks />
          <JobFollowups />
        </div>

        <div className="space-y-4">
          <WeatherWidget />
          <WeeklyHeatmap />
          <PaySummaryCard />
          <SiteHealthDots />
          <BackupStatusCard />
          <QuickLinks />
        </div>
      </div>
    </div>
  );
}
