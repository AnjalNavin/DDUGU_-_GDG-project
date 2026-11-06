export function sanitizeAcademicYear(year) {
  if (!year) return 1;
  const str = String(year).trim();
  const match = str.match(/\b([1-4])(?:st|nd|rd|th)?\b/i) || str.match(/([1-4])/);
  return match ? parseInt(match[1], 10) : 1;
}

export function formatYearLabel(year) {
  const num = sanitizeAcademicYear(year);
  if (num === 1) return '1st Year';
  if (num === 2) return '2nd Year';
  if (num === 3) return '3rd Year';
  if (num === 4) return '4th Year';
  return '1st Year';
}
