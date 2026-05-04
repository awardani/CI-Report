import { formatDateRangeLabel } from '../metrics/time.js';

export const REPORT_PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'past_week', label: 'Past week' },
  { value: 'month_to_date', label: 'Month to date' },
  { value: 'past_6_weeks', label: 'Past 6 weeks' },
  { value: 'past_3_months', label: 'Past 3 months' },
  { value: 'custom', label: 'Custom' },
];

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (value, amount) => {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const addMonths = (value, amount) => {
  const next = new Date(value.getTime());
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
};

const startOfMonth = (value) => (
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
);

const getTodayDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const getReportPeriodAnchorDate = (anchorDate) => {
  const parsedAnchor = parseDate(anchorDate);
  return parsedAnchor || getTodayDate();
};

export const buildReportPeriodRange = (presetValue, anchorDate) => {
  const anchor = getReportPeriodAnchorDate(anchorDate);

  if (presetValue === 'today') {
    const value = formatDate(anchor);
    return {
      startDate: value,
      endDate: value,
    };
  }

  if (presetValue === 'yesterday') {
    const yesterday = addDays(anchor, -1);
    const value = formatDate(yesterday);
    return {
      startDate: value,
      endDate: value,
    };
  }

  if (presetValue === 'past_week') {
    return {
      startDate: formatDate(addDays(anchor, -6)),
      endDate: formatDate(anchor),
    };
  }

  if (presetValue === 'past_6_weeks') {
    return {
      startDate: formatDate(addDays(anchor, -41)),
      endDate: formatDate(anchor),
    };
  }

  if (presetValue === 'month_to_date') {
    return {
      startDate: formatDate(startOfMonth(anchor)),
      endDate: formatDate(anchor),
    };
  }

  if (presetValue === 'past_3_months') {
    const threeMonthAnchor = addMonths(anchor, -2);
    return {
      startDate: formatDate(new Date(Date.UTC(
        threeMonthAnchor.getUTCFullYear(),
        threeMonthAnchor.getUTCMonth(),
        1
      ))),
      endDate: formatDate(anchor),
    };
  }

  return null;
};

const countDaysInRange = (dateRange) => {
  const start = parseDate(dateRange?.startDate);
  const end = parseDate(dateRange?.endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
};

export const inferReportPeriodGranularity = (dateRange, anchorDate) => {
  const preset = getMatchingReportPeriodPreset(dateRange, anchorDate);

  if (preset === 'today' || preset === 'yesterday') {
    return 'daily';
  }

  if (preset === 'past_week' || preset === 'month_to_date') {
    return 'daily';
  }

  if (preset === 'past_6_weeks') {
    return 'weekly';
  }

  if (preset === 'past_3_months') {
    return 'monthly';
  }

  const days = countDaysInRange(dateRange);

  if (days <= 31) {
    return 'daily';
  }

  if (days <= 56) {
    return 'weekly';
  }

  return 'monthly';
};

export const getReportPeriodGranularityLabel = (granularity) => {
  if (granularity === 'monthly') {
    return 'monthly';
  }

  if (granularity === 'weekly') {
    return 'weekly';
  }

  return 'daily';
};

export const getMatchingReportPeriodPreset = (dateRange, anchorDate) => {
  const comparableRange = {
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
  };

  return REPORT_PERIOD_OPTIONS.find((option) => {
    if (option.value === 'custom') {
      return false;
    }

    const presetRange = buildReportPeriodRange(option.value, anchorDate);
    return (
      presetRange?.startDate === comparableRange.startDate &&
      presetRange?.endDate === comparableRange.endDate
    );
  })?.value || 'custom';
};

export const getReportPeriodButtonLabel = (dateRange, anchorDate) => {
  const activePreset = getMatchingReportPeriodPreset(dateRange, anchorDate);
  const activeOption = REPORT_PERIOD_OPTIONS.find((option) => option.value === activePreset);

  if (activePreset !== 'custom' && activeOption) {
    return activeOption.label;
  }

  return formatDateRangeLabel(dateRange?.startDate, dateRange?.endDate) || 'Custom';
};
