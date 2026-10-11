export interface SiteHealth {
  url: string;
  label: string;
  status: "up" | "down" | "error";
  statusCode?: number;
  responseTime?: number; // ms
  checkedAt: string;
}
