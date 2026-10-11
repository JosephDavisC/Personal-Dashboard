// Site identity and locale. Edit to make the dashboard yours.
// These values are compiled into the app, so rebuild after changing them.

export const SITE = {
  // Shown in the browser tab, login page, sidebar, PWA manifest and emails.
  appName: "Personal Dashboard",
  // Your first name. Used by the AI assistant, diary summaries and share emails.
  ownerName: "Alex",
  // IANA timezone used for every date shown and every reminder window.
  timezone: "America/New_York",
  // Cities for the weather widget (Open-Meteo, no API key needed).
  weatherLocations: [
    { name: "New York", lat: 40.7128, lon: -74.006 },
    { name: "London", lat: 51.5072, lon: -0.1276 },
  ],
} as const;
