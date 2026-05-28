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

// Translate a known course-semester value (any casing) via coursesPage.* keys.
// Free-text values (e.g. typos, year strings) pass through unchanged.
export function getSemesterLabel(semester: string, t: (key: string) => string): string {
  const key = { fall: "fall", spring: "spring", summer: "summer", winter: "winter" }[
    semester?.toLowerCase()
  ];
  return key ? t(`coursesPage.${key}`) : semester;
}
