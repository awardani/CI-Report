import React, { memo, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

const GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const MultiSelectFilter = memo(({ label, options, selectedValues, placeholder, onToggle, onClear }) => (
  <div className="filter-input-group filter-input-group-wide">
    <label>{label}</label>
    <details className="multi-select">
      <summary className="glass-input multi-select-trigger">
        <span>{selectedValues.length > 0 ? `${selectedValues.length} selected` : placeholder}</span>
        <ChevronDown size={16} />
      </summary>
      <div className="multi-select-menu">
        <button type="button" className="multi-select-clear" onClick={onClear}>
          Clear selection
        </button>
        <div className="multi-select-options">
          {options.map((option) => {
            const value = typeof option === 'string' ? option : option.value;
            const labelText = typeof option === 'string' ? option : option.label;
            const checked = selectedValues.includes(value);

            return (
              <label key={value} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(value)}
                />
                <span>{labelText}</span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  </div>
));

export const LearningFilters = memo(({
  filters,
  dateRange,
  filterOptions,
  granularity,
  presets,
  activePreset,
  onFilterChange,
  onDateRangeChange,
  onGranularityChange,
  onPresetChange,
  showDateControls = true,
  showGranularityControl = true,
}) => {
  const handleDateChange = (event) => {
    const { name, value } = event.target;
    onDateRangeChange((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleSelection = (fieldName, value) => {
    onFilterChange((prev) => {
      const selectedValues = prev[fieldName] ?? [];
      const nextValues = selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value];

      return {
        ...prev,
        [fieldName]: nextValues,
      };
    });
  };

  const clearSelection = (fieldName) => {
    onFilterChange((prev) => ({
      ...prev,
      [fieldName]: [],
    }));
  };

  const courseLabelMap = useMemo(
    () => new Map(filterOptions.courses.map((course) => [course.value, course.label])),
    [filterOptions.courses]
  );

  const activeFilterChips = useMemo(() => [
    ...filters.courseIds.map((value) => ({
      type: 'courseIds',
      value,
      label: `Course: ${courseLabelMap.get(value) || value}`,
    })),
    ...filters.authors.map((value) => ({
      type: 'authors',
      value,
      label: `Author: ${value}`,
    })),
    ...filters.categories.map((value) => ({
      type: 'categories',
      value,
      label: `Category: ${value}`,
    })),
    ...filters.accessTypes.map((value) => ({
      type: 'accessTypes',
      value,
      label: `Access: ${value}`,
    })),
  ], [filters.courseIds, filters.authors, filters.categories, filters.accessTypes, courseLabelMap]);

  return (
    <div className="filters-bar glass-panel">
      {showGranularityControl && (
        <div className="filters-header">
          <div className="granularity-control">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`granularity-pill ${granularity === option.value ? 'active' : ''}`}
                onClick={() => onGranularityChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {presets.length > 0 && (
        <div className="learning-presets">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`learning-preset-pill ${activePreset === preset.id ? 'active' : ''}`}
              onClick={() => onPresetChange(preset.id)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="filter-controls">
        {showDateControls && (
          <>
            <div className="filter-input-group">
              <label>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateChange}
                className="filter-input glass-input"
              />
            </div>

            <div className="filter-input-group">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateChange}
                className="filter-input glass-input"
              />
            </div>
          </>
        )}

        <MultiSelectFilter
          label="Course"
          options={filterOptions.courses}
          selectedValues={filters.courseIds}
          placeholder="All Courses"
          onToggle={(value) => toggleSelection('courseIds', value)}
          onClear={() => clearSelection('courseIds')}
        />

        <MultiSelectFilter
          label="Author"
          options={filterOptions.authors}
          selectedValues={filters.authors}
          placeholder="All Authors"
          onToggle={(value) => toggleSelection('authors', value)}
          onClear={() => clearSelection('authors')}
        />

        <MultiSelectFilter
          label="Category"
          options={filterOptions.categories}
          selectedValues={filters.categories}
          placeholder="All Categories"
          onToggle={(value) => toggleSelection('categories', value)}
          onClear={() => clearSelection('categories')}
        />

        <MultiSelectFilter
          label="Access"
          options={filterOptions.accessTypes}
          selectedValues={filters.accessTypes}
          placeholder="All Access Types"
          onToggle={(value) => toggleSelection('accessTypes', value)}
          onClear={() => clearSelection('accessTypes')}
        />
      </div>

      {activeFilterChips.length > 0 && (
        <div className="active-filter-chips">
          {activeFilterChips.map((chip) => (
            <button
              key={`${chip.type}-${chip.value}`}
              type="button"
              className="filter-chip"
              onClick={() => toggleSelection(chip.type, chip.value)}
            >
              <span>{chip.label}</span>
              <X size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
