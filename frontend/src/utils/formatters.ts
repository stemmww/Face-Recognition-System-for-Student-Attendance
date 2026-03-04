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
