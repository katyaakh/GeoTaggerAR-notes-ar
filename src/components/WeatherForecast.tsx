import { useState, useEffect } from "react";
import { Calendar, Droplets, Wind, Thermometer, Cloud, Sun, CloudRain, CloudSnow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays } from "date-fns";

interface WeatherForecastProps {
  latitude: number;
  longitude: number;
}

interface ForecastDay {
  date: Date;
  temp: {
    min: number;
    max: number;
  };
  weather: {
    main: string;
    description: string;
  };
  precipitation: number;
  wind: number;
  humidity: number;
  icon: string;
}

const OPENWEATHER_API_KEY = "439d4b804bc8187953eb36d2a8c26a02";

export const WeatherForecast = ({ latitude, longitude }: WeatherForecastProps) => {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForecast();
  }, [latitude, longitude]);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);

    try {
      // Using OpenWeatherMap One Call API 3.0 (free tier)
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch weather data");
      }

      const data = await response.json();

      // Process 5-day forecast data (every 3 hours) into daily forecasts
      const dailyForecasts: ForecastDay[] = [];
      const dailyData: { [key: string]: any[] } = {};

      // Group forecasts by day
      data.list.forEach((item: any) => {
        const date = format(new Date(item.dt * 1000), "yyyy-MM-dd");
        if (!dailyData[date]) {
          dailyData[date] = [];
        }
        dailyData[date].push(item);
      });

      // Calculate daily aggregates
      Object.entries(dailyData).slice(0, 7).forEach(([dateStr, dayData]) => {
        const temps = dayData.map((d) => d.main.temp);
        const rain = dayData.reduce((sum, d) => sum + (d.rain?.["3h"] || 0), 0);
        const winds = dayData.map((d) => d.wind.speed);
        const humidities = dayData.map((d) => d.main.humidity);

        // Get the most common weather condition
        const weatherCounts: { [key: string]: number } = {};
        dayData.forEach((d) => {
          const weather = d.weather[0].main;
          weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
        });
        const mainWeather = Object.keys(weatherCounts).reduce((a, b) =>
          weatherCounts[a] > weatherCounts[b] ? a : b
        );

        const middleIndex = Math.floor(dayData.length / 2);
        const representativeData = dayData[middleIndex];

        dailyForecasts.push({
          date: new Date(dateStr),
          temp: {
            min: Math.min(...temps),
            max: Math.max(...temps),
          },
          weather: {
            main: mainWeather,
            description: representativeData.weather[0].description,
          },
          precipitation: rain,
          wind: winds.reduce((a, b) => a + b, 0) / winds.length,
          humidity: humidities.reduce((a, b) => a + b, 0) / humidities.length,
          icon: representativeData.weather[0].icon,
        });
      });

      setForecast(dailyForecasts);
    } catch (err) {
      setError("Unable to load weather forecast");
      console.error("Weather forecast error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (weatherMain: string, iconCode: string) => {
    const isDay = iconCode.includes("d");
    
    switch (weatherMain.toLowerCase()) {
      case "clear":
        return <Sun className="h-8 w-8 text-yellow-500" />;
      case "clouds":
        return <Cloud className="h-8 w-8 text-gray-500" />;
      case "rain":
      case "drizzle":
        return <CloudRain className="h-8 w-8 text-blue-500" />;
      case "snow":
        return <CloudSnow className="h-8 w-8 text-blue-300" />;
      default:
        return <Cloud className="h-8 w-8 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">7-Day Forecast</h3>
        </div>
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">7-Day Forecast</h3>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">7-Day Forecast</h3>
      </div>

      <div className="space-y-2">
        {forecast.map((day, index) => (
          <Card
            key={index}
            className="p-4 hover:shadow-md transition-shadow"
          >
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
              {/* Date and Weather */}
              <div className="flex items-center gap-3">
                {getWeatherIcon(day.weather.main, day.icon)}
                <div className="flex-1">
                  <div className="font-medium">
                    {index === 0 ? "Today" : format(day.date, "EEE, MMM d")}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {day.weather.description}
                  </div>
                </div>
              </div>

              {/* Temperature */}
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Thermometer className="h-4 w-4 text-red-500" />
                  <span className="font-semibold">{Math.round(day.temp.max)}°</span>
                  <span className="text-muted-foreground text-sm">
                    / {Math.round(day.temp.min)}°
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">High / Low</div>
              </div>

              {/* Weather Details */}
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1">
                  <Droplets className="h-3 w-3 text-blue-500" />
                  <span>{day.precipitation.toFixed(1)}mm</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="h-3 w-3 text-cyan-500" />
                  <span>{day.wind.toFixed(1)} m/s</span>
                </div>
              </div>
            </div>

            {/* Progress bar for precipitation */}
            {day.precipitation > 0 && (
              <div className="mt-2">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.min(day.precipitation * 10, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-4 text-xs text-muted-foreground text-center">
        Weather data provided by OpenWeatherMap
      </div>
    </Card>
  );
};
