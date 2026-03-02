const HK_TIMEZONE = 'Asia/Hong_Kong';

const hkDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HK_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns YYYY-MM-DD in Hong Kong timezone (UTC+8).
 * All users are currently HK-based, so we hardcode the timezone
 * instead of relying on the device's local clock.
 */
export const getHKDateString = (date: Date = new Date()): string => {
  return hkDateFormatter.format(date);
};
