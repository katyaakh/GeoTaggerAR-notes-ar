import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataPoint {
  date: string;
  value: number;
}

interface IndicatorData {
  name: string;
  current: number;
  unit: string;
  trend: "up" | "down" | "stable";
  change: number;
  history: DataPoint[];
  status: "good" | "warning" | "poor";
}

interface SatelliteDataIndicatorsProps {
  latitude: number;
  longitude: number;
}

const generateHistoricalData = (
  baseValue: number,
  days: number,
  variance: number
): DataPoint[] => {
  const data: DataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const randomChange = (Math.random() - 0.5) * variance;
    const value = Math.max(0, baseValue + randomChange);

    data.push({
      date: date.toISOString().split("T")[0],
      value: parseFloat(value.toFixed(2)),
    });
  }

  return data;
};

const getIndicatorStatus = (
  name: string,
  value: number
): "good" | "warning" | "poor" => {
  if (name === "NDVI") {
    if (value >= 0.6) return "good";
    if (value >= 0.4) return "warning";
    return "poor";
  } else if (name === "Soil Moisture") {
    if (value >= 30 && value <= 50) return "good";
    if (value >= 20 && value <= 60) return "warning";
    return "poor";
  } else if (name === "Temperature") {
    if (value >= 15 && value <= 25) return "good";
    if (value >= 10 && value <= 30) return "warning";
    return "poor";
  }
  return "good";
};

const calculateTrend = (history: DataPoint[]): { trend: "up" | "down" | "stable"; change: number } => {
  if (history.length < 2) return { trend: "stable", change: 0 };

  const recent = history.slice(-3);
  const older = history.slice(-6, -3);

  const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
  const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (Math.abs(change) < 2) return { trend: "stable", change: 0 };
  return { trend: change > 0 ? "up" : "down", change: Math.abs(change) };
};

export const SatelliteDataIndicators = ({ latitude, longitude }: SatelliteDataIndicatorsProps) => {
  const [period, setPeriod] = useState<string>("10");

  // Generate mock data based on location
  const seed = Math.abs(Math.sin(latitude * longitude) * 1000);
  const ndviBase = 0.55 + (seed % 20) / 100;
  const moistureBase = 30 + (seed % 20);
  const tempBase = 18 + (seed % 10);

  const days = parseInt(period);

  const indicators: IndicatorData[] = [
    {
      name: "NDVI",
      current: parseFloat(ndviBase.toFixed(2)),
      unit: "",
      history: generateHistoricalData(ndviBase, days, 0.1),
      trend: "stable",
      change: 0,
      status: "good",
    },
    {
      name: "Soil Moisture",
      current: parseFloat(moistureBase.toFixed(1)),
      unit: "%",
      history: generateHistoricalData(moistureBase, days, 5),
      trend: "stable",
      change: 0,
      status: "good",
    },
    {
      name: "Temperature",
      current: parseFloat(tempBase.toFixed(1)),
      unit: "°C",
      history: generateHistoricalData(tempBase, days, 3),
      trend: "stable",
      change: 0,
      status: "good",
    },
  ];

  // Calculate trends
  indicators.forEach((indicator) => {
    const { trend, change } = calculateTrend(indicator.history);
    indicator.trend = trend;
    indicator.change = change;
    indicator.status = getIndicatorStatus(indicator.name, indicator.current);
  });

  const MiniChart = ({ data }: { data: DataPoint[] }) => {
    const max = Math.max(...data.map((d) => d.value));
    const min = Math.min(...data.map((d) => d.value));
    const range = max - min || 1;

    return (
      <div className="flex items-end gap-[2px] h-8">
        {data.map((point, i) => {
          const height = ((point.value - min) / range) * 100;
          return (
            <div
              key={i}
              className="flex-1 bg-primary/30 rounded-t-sm relative group"
              style={{ height: `${Math.max(height, 5)}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
                <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {point.value}
                  <br />
                  {new Date(point.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Satellite Data Indicators
        </h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="10">Last 10 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {indicators.map((indicator) => (
          <Card key={indicator.name} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{indicator.name}</span>
                      <Badge
                        variant={
                          indicator.status === "good"
                            ? "default"
                            : indicator.status === "warning"
                            ? "secondary"
                            : "destructive"
                        }
                        className="h-5 text-xs"
                      >
                        {indicator.status}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {indicator.current}
                        {indicator.unit}
                      </span>
                      {indicator.trend !== "stable" && (
                        <div className="flex items-center gap-1 text-xs">
                          {indicator.trend === "up" ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          <span
                            className={
                              indicator.trend === "up" ? "text-green-600" : "text-red-600"
                            }
                          >
                            {indicator.change.toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {indicator.trend === "stable" && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Minus className="h-3 w-3" />
                          <span>stable</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <MiniChart data={indicator.history} />

                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>
                    {new Date(indicator.history[0].date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>
                    {new Date(
                      indicator.history[indicator.history.length - 1].date
                    ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
