import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, PencilLine } from 'lucide-react';
import {
  buildReportPeriodRange,
  getMatchingReportPeriodPreset,
  getReportPeriodButtonLabel,
  REPORT_PERIOD_OPTIONS,
} from '../utils/reportPeriod.js';

export const ReportPeriodControl = memo(({
  dateRange,
  onDateRangeChange,
  anchorDate,
}) => {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [draftRange, setDraftRange] = useState({
    startDate: dateRange?.startDate || '',
    endDate: dateRange?.endDate || '',
  });

  const activePreset = useMemo(
    () => getMatchingReportPeriodPreset(dateRange, anchorDate),
    [dateRange, anchorDate]
  );
  const buttonLabel = useMemo(
    () => getReportPeriodButtonLabel(dateRange, anchorDate),
    [dateRange, anchorDate]
  );

  useEffect(() => {
    setDraftRange({
      startDate: dateRange?.startDate || '',
      endDate: dateRange?.endDate || '',
    });
    setShowCustomPanel(activePreset === 'custom');
  }, [dateRange, activePreset]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const handlePresetSelect = (presetValue) => {
    if (presetValue === 'custom') {
      setShowCustomPanel(true);
      return;
    }

    const nextRange = buildReportPeriodRange(presetValue, anchorDate);

    if (nextRange) {
      onDateRangeChange(nextRange);
    }

    setShowCustomPanel(false);
    setIsOpen(false);
  };

  const handleDraftChange = (event) => {
    const { name, value } = event.target;
    setDraftRange((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCancel = () => {
    setDraftRange({
      startDate: dateRange?.startDate || '',
      endDate: dateRange?.endDate || '',
    });
    setShowCustomPanel(activePreset === 'custom');
    setIsOpen(false);
  };

  const handleApply = () => {
    if (!draftRange.startDate || !draftRange.endDate || draftRange.startDate > draftRange.endDate) {
      return;
    }

    onDateRangeChange({
      startDate: draftRange.startDate,
      endDate: draftRange.endDate,
    });
    setIsOpen(false);
  };

  return (
    <div className="report-period-control" ref={rootRef}>
      <button
        type="button"
        className={`section-control-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <CalendarDays size={16} />
        <span>{buttonLabel}</span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className={`report-period-popover ${showCustomPanel ? 'with-custom-panel' : ''}`}>
          <div className="report-period-menu">
            {REPORT_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`report-period-option ${activePreset === option.value ? 'active' : ''}`}
                onClick={() => handlePresetSelect(option.value)}
              >
                <span className="report-period-option-label">
                  {option.value === 'custom' ? <PencilLine size={16} /> : <CalendarDays size={16} />}
                  <span>{option.label}</span>
                </span>
                {activePreset === option.value && <Check size={16} />}
              </button>
            ))}
          </div>

          {showCustomPanel && (
            <div className="report-period-custom-panel">
              <div className="report-period-custom-fields">
                <label className="report-period-date-field">
                  <span>From</span>
                  <input
                    type="date"
                    name="startDate"
                    value={draftRange.startDate}
                    onChange={handleDraftChange}
                    className="glass-input"
                  />
                </label>

                <label className="report-period-date-field">
                  <span>To</span>
                  <input
                    type="date"
                    name="endDate"
                    value={draftRange.endDate}
                    onChange={handleDraftChange}
                    className="glass-input"
                  />
                </label>
              </div>

              <div className="report-period-actions">
                <button type="button" className="report-period-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="report-period-primary"
                  onClick={handleApply}
                  disabled={
                    !draftRange.startDate ||
                    !draftRange.endDate ||
                    draftRange.startDate > draftRange.endDate
                  }
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

