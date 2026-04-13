const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});

const RANGE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const parseDate = (value) => {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (value) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatShortDay = (value) => DAY_LABEL_FORMATTER.format(value);
const formatMonthLabel = (value) => MONTH_LABEL_FORMATTER.format(value);

export const formatDateRangeLabel = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    return '';
  }

  return `${RANGE_LABEL_FORMATTER.format(start)} - ${RANGE_LABEL_FORMATTER.format(end)}`;
};

export const addDays = (value, amount) => {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const addMonths = (value, amount) => {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  const targetMonth = month + amount;
  const firstOfTarget = new Date(Date.UTC(year, targetMonth, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth() + 1,
    0
  )).getUTCDate();

  return new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth(),
    Math.min(day, lastDayOfTargetMonth)
  ));
};

const startOfWeek = (value) => {
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(value, diff);
};

const endOfWeek = (value) => addDays(startOfWeek(value), 6);

const startOfMonth = (value) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const endOfMonth = (value) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));

const compareDates = (left, right) => left.getTime() - right.getTime();
const minDate = (left, right) => (compareDates(left, right) <= 0 ? left : right);
const maxDate = (left, right) => (compareDates(left, right) >= 0 ? left : right);

const getBucketBounds = (value, granularity) => {
  if (granularity === 'weekly') {
    return {
      start: startOfWeek(value),
      end: endOfWeek(value),
    };
  }

  if (granularity === 'monthly') {
    return {
      start: startOfMonth(value),
      end: endOfMonth(value),
    };
  }

  return {
    start: value,
    end: value,
  };
};

const getNextBucketStart = (value, granularity) => {
  if (granularity === 'weekly') {
    return addDays(value, 7);
  }

  if (granularity === 'monthly') {
    return addMonths(value, 1);
  }

  return addDays(value, 1);
};

const getBucketLabel = (bucketStart, bucketEnd, clippedStart, clippedEnd, granularity) => {
  if (granularity === 'monthly') {
    return formatMonthLabel(bucketStart);
  }

  if (granularity === 'weekly') {
    const renderedStart = compareDates(bucketStart, clippedStart) === 0 ? bucketStart : clippedStart;
    const renderedEnd = compareDates(bucketEnd, clippedEnd) === 0 ? bucketEnd : clippedEnd;
    return `${formatShortDay(renderedStart)} - ${formatShortDay(renderedEnd)}`;
  }

  return formatShortDay(bucketStart);
};

export const listBucketsInRange = (startDate, endDate, granularity) => {
  const parsedStart = parseDate(startDate);
  const parsedEnd = parseDate(endDate);

  if (!parsedStart || !parsedEnd || compareDates(parsedStart, parsedEnd) > 0) {
    return [];
  }

  const buckets = [];
  let cursor = getBucketBounds(parsedStart, granularity).start;

  while (compareDates(cursor, parsedEnd) <= 0) {
    const { start, end } = getBucketBounds(cursor, granularity);
    const clippedStart = maxDate(start, parsedStart);
    const clippedEnd = minDate(end, parsedEnd);

    if (compareDates(clippedStart, clippedEnd) <= 0) {
      buckets.push({
        key: formatDate(start),
        startDate: formatDate(clippedStart),
        endDate: formatDate(clippedEnd),
        label: getBucketLabel(start, end, clippedStart, clippedEnd, granularity),
      });
    }

    cursor = getNextBucketStart(start, granularity);
  }

  return buckets;
};

const countUniqueMonthsInRange = (startDate, endDate) => {
  const months = new Set(
    listBucketsInRange(startDate, endDate, 'monthly').map((bucket) => bucket.key.slice(0, 7))
  );
  return months.size;
};

export const getGranularityLabel = (granularity) => {
  if (granularity === 'weekly') return 'Weekly';
  if (granularity === 'monthly') return 'Monthly';
  return 'Daily';
};

export const buildPreviousPeriodRange = (startDate, endDate, granularity) => {
  const parsedStart = parseDate(startDate);
  const parsedEnd = parseDate(endDate);

  if (!parsedStart || !parsedEnd || compareDates(parsedStart, parsedEnd) > 0) {
    return null;
  }

  if (granularity === 'monthly') {
    const monthCount = countUniqueMonthsInRange(startDate, endDate);
    return {
      startDate: formatDate(addMonths(parsedStart, monthCount * -1)),
      endDate: formatDate(addMonths(parsedEnd, monthCount * -1)),
      unitCount: monthCount,
      unitLabel: monthCount === 1 ? 'month' : 'months',
    };
  }

  const buckets = listBucketsInRange(startDate, endDate, granularity);
  const dayOffset = granularity === 'weekly'
    ? buckets.length * 7
    : buckets.length;

  return {
    startDate: formatDate(addDays(parsedStart, dayOffset * -1)),
    endDate: formatDate(addDays(parsedEnd, dayOffset * -1)),
    unitCount: buckets.length,
    unitLabel: granularity === 'weekly'
      ? buckets.length === 1 ? 'week' : 'weeks'
      : buckets.length === 1 ? 'day' : 'days',
  };
};
