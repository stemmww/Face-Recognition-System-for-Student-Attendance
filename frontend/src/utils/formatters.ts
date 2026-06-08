import dayjs from "dayjs";

export function formatDate(date: string): string {
  return dayjs(date).format("MMM D, YYYY");
}

export function formatDateTime(date: string): string {
  return dayjs(date).format("MMM D, YYYY HH:mm");
}

export function formatTime(time: string): string {
  return dayjs(time, "HH:mm:ss").format("HH:mm");
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

// Translate a known academic term value (any casing) via i18n keys.
// Free-text values (e.g. typos, year strings) pass through unchanged.
export function getSemesterLabel(semester: string, t: (key: string) => string): string {
  const normalized = semester?.toUpperCase();
  if (["TRIMESTER_1", "TRIMESTER_2", "TRIMESTER_3"].includes(normalized)) {
    return t(`groups.sem_${normalized}`);
  }
  const legacyKey = { FALL: "fall", SPRING: "spring", SUMMER: "summer", WINTER: "winter" }[normalized];
  return legacyKey ? t(`coursesPage.${legacyKey}`) : semester;
}
