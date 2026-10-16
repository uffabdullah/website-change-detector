export function formatInterval(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes % 60 === 0 && minutes < 1440) return `${minutes / 60} hours`;
  if (minutes === 1440) return "24 hours";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} m` : `${minutes} min`;
}

export function formatWhen(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function statusLabel(status: string) {
  if (status === "ok") return "OK";
  if (status === "blocked") return "Blocked";
  return "Error";
}
