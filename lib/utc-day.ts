// Keep a live view on today's UTC date, while preserving a selected past date.
export function advanceLiveDate(selected: string, previousToday: string, nextToday: string) {
  return selected === previousToday ? nextToday : selected;
}
