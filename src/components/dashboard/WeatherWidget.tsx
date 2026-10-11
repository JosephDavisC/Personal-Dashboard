"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  CloudMoon,
  Droplets,
  Wind,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CityWeather } from "@/app/api/weather/route";

function getWeatherIcon(code: number, isDay: boolean) {
  if (code === 0) return isDay ? Sun : Moon;
  if (code <= 3) return isDay ? Cloud : CloudMoon;
  if (code <= 49) return CloudFog;
  if (code <= 59) return CloudDrizzle;
  if (code <= 69) return CloudRain;
  if (code <= 79) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  if (code <= 99) return CloudLightning;
  return Cloud;
}

function getWeatherColor(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "text-yellow-500" : "text-indigo-400";
  if (code <= 3) return "text-slate-400";
  if (code <= 49) return "text-slate-400";
  if (code <= 69) return "text-blue-400";
  if (code <= 79) return "text-sky-300";
  if (code <= 82) return "text-blue-500";
  if (code <= 86) return "text-sky-300";
  if (code <= 99) return "text-purple-400";
  return "text-slate-400";
}

export function WeatherWidget() {
  const { data: cities = [], isLoading } = useQuery<CityWeather[]>({
    queryKey: ["weather"],
    queryFn: async () => {
      const res = await fetch("/api/weather");
      if (!res.ok) return [];
      const json = (await res.json()) as { data: CityWeather[] };
      return json.data;
    },
    staleTime: 10 * 60 * 1000, // 10 min
    refetchInterval: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <p className="text-center text-sm text-muted-foreground/60">
            Loading weather...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (cities.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {cities.map((city) => {
        const Icon = getWeatherIcon(city.weatherCode, city.isDay);
        const iconColor = getWeatherColor(city.weatherCode, city.isDay);

        return (
          <Card key={city.city} className="border-border bg-card">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {city.city}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {city.temperature}°
                    <span className="text-sm font-normal text-muted-foreground">
                      C
                    </span>
                  </p>
                </div>
                <Icon className={cn("h-7 w-7 shrink-0", iconColor)} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {city.condition}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                <span className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  {city.humidity}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="h-3 w-3" />
                  {city.windSpeed} km/h
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
