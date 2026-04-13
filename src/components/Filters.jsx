import React, { memo, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';

const GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TEAM_GROUPS = [
  {
    value: 'seller_365_sr',
    label: 'Seller 365+SR',
    teams: [
      'unassigned',
      'inventorylab',
      'tactical arbitrage',
      'scoutIQ',
      'FeedbackWhiz',
      'SmartRepricer',
      'SellerRunning',
      'support led growth',
      'threecolts support general',
      'trial concierge',
    ],
  },
  {
    value: 'seller_365',
    label: 'Seller 365',
    teams: [
      'unassigned',
      'inventorylab',
      'tactical arbitrage',
      'scoutIQ',
      'FeedbackWhiz',
      'SmartRepricer',
      'support led growth',
      'threecolts support general',
      'trial concierge',
    ],
  },
];

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

const arrayMatches = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const resolveGroupTeams = (groupValue, availableTeams) => {
  const selectedGroup = TEAM_GROUPS.find((group) => group.value === groupValue);

  if (!selectedGroup) {
    return [];
  }

  const availableTeamMap = new Map(
    availableTeams.map((team) => [normalizeKey(team), team])
  );

  return selectedGroup.teams
    .map((team) => availableTeamMap.get(normalizeKey(team)))
    .filter(Boolean);
};

const getGroupLabel = (groupValue) =>
  TEAM_GROUPS.find((group) => group.value === groupValue)?.label ?? '';

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
            const checked = selectedValues.includes(option);

            return (
              <label key={option} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  </div>
));

export const Filters = memo(({
  availableTeams,
  availableTeammates,
  filters,
  granularity,
  onFilterChange,
  onGranularityChange,
  showDateControls = true,
  showGranularityControl = true,
}) => {
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    onFilterChange((prev) => ({ ...prev, [name]: value }));
  };

  const syncGroupAfterTeamChange = (groupValue, nextTeams) => {
    if (!groupValue) {
      return '';
    }

    const expectedGroupTeams = resolveGroupTeams(groupValue, availableTeams).sort((left, right) => left.localeCompare(right));
    const sortedTeams = [...nextTeams].sort((left, right) => left.localeCompare(right));

    return arrayMatches(sortedTeams, expectedGroupTeams) ? groupValue : '';
  };

  const toggleSelection = (fieldName, option) => {
    onFilterChange((prev) => {
      const selectedValues = prev[fieldName] ?? [];
      const nextValues = selectedValues.includes(option)
        ? selectedValues.filter((item) => item !== option)
        : [...selectedValues, option];

      const nextState = {
        ...prev,
        [fieldName]: nextValues,
      };

      if (fieldName === 'team') {
        nextState.teamGroup = syncGroupAfterTeamChange(prev.teamGroup, nextValues);
      }

      return nextState;
    });
  };

  const clearSelection = (fieldName) => {
    onFilterChange((prev) => {
      const nextState = {
        ...prev,
        [fieldName]: [],
      };

      if (fieldName === 'team') {
        nextState.teamGroup = '';
      }

      return nextState;
    });
  };

  const handleTeamGroupChange = (e) => {
    const nextGroup = e.target.value;
    const mappedTeams = resolveGroupTeams(nextGroup, availableTeams).sort((left, right) => left.localeCompare(right));

    onFilterChange((prev) => ({
      ...prev,
      teamGroup: nextGroup,
      team: nextGroup ? mappedTeams : prev.team,
    }));
  };

  const clearTeamGroup = () => {
    onFilterChange((prev) => ({
      ...prev,
      teamGroup: '',
    }));
  };

  const activeFilterChips = useMemo(() => [
    ...(filters.teamGroup ? [{
      type: 'teamGroup',
      value: filters.teamGroup,
      label: `Group: ${getGroupLabel(filters.teamGroup)}`,
    }] : []),
    ...filters.team.map((value) => ({ type: 'team', value, label: `Team: ${value}` })),
    ...filters.teammate.map((value) => ({ type: 'teammate', value, label: `Teammate: ${value}` })),
  ], [filters.teamGroup, filters.team, filters.teammate]);

  const handleChipRemove = (chip) => {
    if (chip.type === 'teamGroup') {
      clearTeamGroup();
      return;
    }

    toggleSelection(chip.type, chip.value);
  };

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

      <div className="filter-controls">
        {showDateControls && (
          <>
            <div className="filter-input-group">
              <label>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleDateChange}
                className="filter-input glass-input"
              />
            </div>

            <div className="filter-input-group">
              <label>End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleDateChange}
                className="filter-input glass-input"
              />
            </div>
          </>
        )}

        <div className="filter-input-group">
          <label>Team Group</label>
          <select
            name="teamGroup"
            value={filters.teamGroup}
            onChange={handleTeamGroupChange}
            className="filter-input glass-input"
          >
            <option value="">No Preset</option>
            {TEAM_GROUPS.map((group) => (
              <option key={group.value} value={group.value}>{group.label}</option>
            ))}
          </select>
        </div>

        <MultiSelectFilter
          label="Team"
          options={availableTeams}
          selectedValues={filters.team}
          placeholder="All Teams"
          onToggle={(option) => toggleSelection('team', option)}
          onClear={() => clearSelection('team')}
        />

        <MultiSelectFilter
          label="Teammate"
          options={availableTeammates}
          selectedValues={filters.teammate}
          placeholder="All Teammates"
          onToggle={(option) => toggleSelection('teammate', option)}
          onClear={() => clearSelection('teammate')}
        />
      </div>

      {activeFilterChips.length > 0 && (
        <div className="active-filter-chips">
          {activeFilterChips.map((chip) => (
            <button
              key={`${chip.type}-${chip.value}`}
              type="button"
              className="filter-chip"
              onClick={() => handleChipRemove(chip)}
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
