import React, { memo } from 'react';

const OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const ChartGranularityControl = memo(({
  value,
  onChange,
  compact = false,
}) => (
  <div className={`granularity-control ${compact ? 'compact' : ''}`}>
    {OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        className={`granularity-pill ${value === option.value ? 'active' : ''}`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
));
