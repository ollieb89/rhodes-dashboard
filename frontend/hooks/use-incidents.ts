import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface Incident {
  id: string;
  source: string;
  severity: "critical" | "warning" | "info";
  title: string;
  text: string;
  timestamp: string | null;
  url: string | null;
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [counts, setCounts] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [hasNew, setHasNew] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
        setCounts(data.counts || { critical: 0, warning: 0, info: 0, total: 0 });

        // Check if there are new incidents not in localStorage
        const lastSeenId = typeof window !== 'undefined' ? localStorage.getItem("incidents:lastSeenId") : null;
        const latestId = data.incidents && data.incidents.length > 0 ? data.incidents[0].id : null;
        
        if (latestId && latestId !== lastSeenId) {
          setHasNew(true);
        } else {
          setHasNew(false);
        }
      }
    } catch (err) {
      console.error("Failed to fetch incidents", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(() => {
    if (incidents.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem("incidents:lastSeenId", incidents[0].id);
      setHasNew(false);
    }
  }, [incidents]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [refresh]);

  return { incidents, counts, loading, hasNew, refresh, markAsRead };
}
