import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { SITE } from "@/config/site";

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  current_units: {
    temperature_2m: string;
  };
  timezone: string;
}

export interface CityWeather {
  city: string;
  temperature: number;
  unit: string;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  condition: string;
  timezone: string;
}

const CITIES = SITE.weatherLocations;

function weatherCodeToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: CityWeather[] = await Promise.all(
      CITIES.map(async (city) => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&temperature_unit=celsius&timezone=auto`;
        const res = await fetch(url, { next: { revalidate: 600 } });
        const data = (await res.json()) as OpenMeteoResponse;

        return {
          city: city.name,
          temperature: Math.round(data.current.temperature_2m),
          unit: data.current_units.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          weatherCode: data.current.weather_code,
          isDay: data.current.is_day === 1,
          condition: weatherCodeToCondition(data.current.weather_code),
          timezone: data.timezone,
        };
      })
    );

    return NextResponse.json({ data: results });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
