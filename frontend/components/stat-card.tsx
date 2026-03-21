"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface SparkPoint {
  value: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  accent?: string;
  sparkData?: SparkPoint[];
  sparkColor?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  accent = "text-violet-400",
  sparkData,
  sparkColor = "#8b5cf6",
}: StatCardProps) {
  const hasSpark = sparkData && sparkData.length > 1;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">
              {label}
            </p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{value}</p>
            {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-zinc-800 ${accent}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {hasSpark && (
          <div className="mt-3 h-10">
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200">
                          {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
