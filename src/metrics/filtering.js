const getDatePart = (timestamp) => (timestamp ? timestamp.split(' ')[0] : null);

const resolveTeammateName = (item, teammateFields = []) => {
  for (const fieldName of teammateFields) {
    if (item[fieldName]) {
      return item[fieldName];
    }
  }

  return null;
};

const normalizeSelectedValues = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
};

export const applyMetricFilters = (items, filters, config) => {
  const selectedTeams = normalizeSelectedValues(filters.team);
  const selectedTeammates = normalizeSelectedValues(filters.teammate);
  const metadata = {
    timestamp_field: config.timestampField,
    missing_team_metadata_count: 0,
    missing_teammate_metadata_count: 0,
  };

  const filteredItems = items.filter((item) => {
    const itemDate = getDatePart(item[config.timestampField]);

    if (!itemDate) {
      return false;
    }

    if (filters.startDate && itemDate < filters.startDate) {
      return false;
    }

    if (filters.endDate && itemDate > filters.endDate) {
      return false;
    }

    if (selectedTeams.length > 0) {
      const teamValue = config.teamField ? item[config.teamField] : null;

      if (!teamValue) {
        metadata.missing_team_metadata_count += 1;
        return false;
      }

      if (!selectedTeams.includes(teamValue)) {
        return false;
      }
    }

    if (selectedTeammates.length > 0) {
      const teammateValue = resolveTeammateName(item, config.teammateFields ?? []);

      if (!teammateValue) {
        metadata.missing_teammate_metadata_count += 1;
        return false;
      }

      if (!selectedTeammates.includes(teammateValue)) {
        return false;
      }
    }

    return true;
  });

  return {
    items: filteredItems,
    metadata,
  };
};
