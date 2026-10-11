"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNavPreference } from "@/hooks/useNavPreference";
import { Input } from "@/components/ui/input";
import { Navigation, Bell, BellOff, Smartphone, Trash2, Send, Loader2, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface PushSub {
  id: string;
  device: string | null;
  endpoint: string;
  createdAt: string;
}

interface Prefs {
  shiftReminders: boolean;
  taskDue: boolean;
  siteAlerts: boolean;
  weeklySummary: boolean;
  jobUpdates: boolean;
  diaryReminder: boolean;
  driveBackup: boolean;
  stringAge: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Unknown Device";
}

export function SettingsPage() {
  const { navMode, setNavMode } = useNavPreference();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize your dashboard experience
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Navigation className="h-5 w-5" />
            Navigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="nav-mode" className="text-sm font-medium">
                Bottom navigation bar
              </Label>
              <p className="text-xs text-muted-foreground">
                Show a fixed navigation bar at the bottom on mobile. When off, uses the hamburger menu instead.
              </p>
            </div>
            <Switch
              id="nav-mode"
              checked={navMode === "bottom"}
              onCheckedChange={(checked) => setNavMode(checked ? "bottom" : "burger")}
            />
          </div>
        </CardContent>
      </Card>

      <NotificationSettings />
    </div>
  );
}

function NotificationSettings() {
  const queryClient = useQueryClient();
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [isStandalone, setIsStandalone] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");

  useEffect(() => {
    // Check if push is supported
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<PushSub[]>({
    queryKey: ["push-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/push/subscriptions");
      const json = await res.json() as { data: PushSub[] };
      return json.data;
    },
  });

  const { data: prefs } = useQuery<Prefs>({
    queryKey: ["push-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/push/preferences");
      const json = await res.json() as { data: Prefs };
      return json.data;
    },
  });

  const updatePrefMutation = useMutation({
    mutationFn: async (update: Partial<Prefs>) => {
      const res = await fetch("/api/push/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      return res.json() as Promise<{ data: Prefs }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push-preferences"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/push/subscriptions?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-subscriptions"] });
      toast.success("Device removed");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/push/test");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ data: { sent: number } }>;
    },
    onSuccess: (result) => {
      toast.success(`Test notification sent to ${result.data.sent} device(s)`);
    },
    onError: () => toast.error("Failed to send test notification"),
  });

  const customTestMutation = useMutation({
    mutationFn: async ({ title, body }: { title: string; body: string }) => {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ data: { sent: number } }>;
    },
    onSuccess: (result) => {
      toast.success(`Custom notification sent to ${result.data.sent} device(s)`);
      setCustomTitle("");
      setCustomBody("");
    },
    onError: () => toast.error("Failed to send custom notification"),
  });

  const handleSubscribe = useCallback(async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const keyRes = await fetch("/api/push/vapid-key");
      const keyJson = await keyRes.json() as { data: { key: string } };
      if (!keyJson.data?.key) {
        toast.error("Push notifications not configured on server");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.data.key).buffer as ArrayBuffer,
      });

      const sub = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
          device: getDeviceLabel(),
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["push-subscriptions"] });
      toast.success("Push notifications enabled");
    } catch (err) {
      console.error("Subscribe error:", err);
      toast.error("Failed to enable notifications");
    } finally {
      setSubscribing(false);
    }
  }, [queryClient]);

  const isEnabled = subscriptions.length > 0;

  const prefItems: { key: keyof Prefs; label: string; description: string }[] = [
    { key: "shiftReminders", label: "Shift reminders", description: "30 minutes before a shift starts" },
    { key: "taskDue", label: "Task due dates", description: "Morning reminder for tasks due today" },
    { key: "siteAlerts", label: "Site down alerts", description: "When a monitored site goes down or recovers" },
    { key: "weeklySummary", label: "Weekly summary", description: "When the weekly summary email is sent" },
    { key: "jobUpdates", label: "Job application updates", description: "When a status changes to Interview or Offer" },
    { key: "diaryReminder", label: "Diary reminder", description: "When you haven't written a diary entry in 2+ days" },
    { key: "driveBackup", label: "Drive backup", description: "After a Google Drive backup completes" },
    { key: "stringAge", label: "String age alerts", description: "When racket strings are 60+ or 90+ days old" },
  ];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        {permissionState === "unsupported" ? (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <BellOff className="h-4 w-4 shrink-0" />
            Push notifications are not supported on this device/browser.
          </div>
        ) : !isStandalone ? (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-400">
            <Smartphone className="h-4 w-4 shrink-0" />
            Add the dashboard to your home screen first to enable push notifications.
          </div>
        ) : permissionState === "denied" ? (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <BellOff className="h-4 w-4 shrink-0" />
            Notifications blocked. Enable them in your browser/device settings.
          </div>
        ) : null}

        {/* Enable button */}
        {permissionState !== "unsupported" && permissionState !== "denied" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {isEnabled ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Notifications enabled
                  </span>
                ) : (
                  "Enable push notifications"
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {isEnabled
                  ? `Active on ${subscriptions.length} device(s)`
                  : "Get alerts for shifts, tasks, sites, and more"}
              </p>
            </div>
            <div className="flex gap-2">
              {isEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Test
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSubscribe}
                disabled={subscribing}
              >
                {subscribing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bell className="mr-1.5 h-3.5 w-3.5" />}
                {isEnabled ? "Add This Device" : "Enable Notifications"}
              </Button>
            </div>
          </div>
        )}

        {/* Custom test notification */}
        {isEnabled && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Send Custom Notification
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="text-base sm:text-sm sm:w-1/3"
              />
              <Input
                placeholder="Body message"
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="text-base sm:text-sm sm:flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => customTestMutation.mutate({ title: customTitle, body: customBody })}
                disabled={customTestMutation.isPending || !customTitle.trim() || !customBody.trim()}
              >
                {customTestMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="mr-1.5 h-3.5 w-3.5" />}
                Send
              </Button>
            </div>
          </div>
        )}

        {/* Active devices */}
        {isEnabled && !subsLoading && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Active Devices
            </p>
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{sub.device || "Unknown Device"}</p>
                  <p className="text-xs text-muted-foreground">
                    Registered {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMutation.mutate(sub.id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Notification preferences */}
        {isEnabled && prefs && (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Notification Types
            </p>
            {prefItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`pref-${item.key}`} className="text-sm font-medium">
                    {item.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  id={`pref-${item.key}`}
                  checked={prefs[item.key]}
                  onCheckedChange={(checked) => updatePrefMutation.mutate({ [item.key]: checked })}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
