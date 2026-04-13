import React, { memo } from 'react';
import { CalendarRange } from 'lucide-react';

export const SharedControls = memo(({
  dateRange,
  onDateRangeChange,
}) => {
  const handleDateChange = (event) => {
    const { name, value } = event.target;
    onDateRangeChange((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  return (
    <div className="shared-controls">
      <div className="shared-controls-group">
        <div className="shared-controls-label">
          <CalendarRange size={16} />
          <span>Reporting period</span>
        </div>
        <div className="shared-date-range">
          <input
            type="date"
            name="startDate"
            value={dateRange.startDate}
            onChange={handleDateChange}
            className="filter-input glass-input"
          />
          <span className="shared-date-separator">to</span>
          <input
            type="date"
            name="endDate"
            value={dateRange.endDate}
            onChange={handleDateChange}
            className="filter-input glass-input"
          />
        </div>
      </div>
    </div>
  );
});
