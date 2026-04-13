import React, { memo, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { LearningFilters } from './LearningFilters';
import { LearningPanel } from './LearningPanel';
import { loadConfiguredLearnWorldsSource } from '../dataSources/index.js';
import { buildLearnWorldsDashboardViewModel } from '../learnworlds/dashboard.js';
import { applyLearnWorldsFilters, getLearnWorldsFilterOptions } from '../learnworlds/filtering.js';
import { normalizeLearnWorldsDatasets } from '../learnworlds/normalization.js';
import { validateLearnWorldsData } from '../learnworlds/validation.js';

const EMPTY_FILTERS = {
  courseIds: [],
  authors: [],
  categories: [],
  accessTypes: [],
};

const buildPresetFilters = (presetId, presetCourseIds) => {
  if (presetId === 'all_courses') {
    return { ...EMPTY_FILTERS };
  }

  return {
    ...EMPTY_FILTERS,
    courseIds: presetCourseIds,
  };
};

const arraysEqual = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const filtersMatch = (left, right) =>
  arraysEqual(left.courseIds, right.courseIds) &&
  arraysEqual(left.authors, right.authors) &&
  arraysEqual(left.categories, right.categories) &&
  arraysEqual(left.accessTypes, right.accessTypes);

const sortValues = (values) => [...values].sort((left, right) => left.localeCompare(right));

const buildPresetViews = (baseViewModel) => {
  const mostEngagingCourseIds = baseViewModel.tables.mostEngagingCourses.rows
    .slice(0, 5)
    .map((row) => row.course_id)
    .filter(Boolean);
  const dropoutWatchCourseIds = baseViewModel.tables.mostDroppedOutCourses.rows
    .slice(0, 5)
    .map((row) => row.course_id)
    .filter(Boolean);
  const newLearnerActivityCourseIds = baseViewModel.tables.mostPopularCourses.rows
    .slice(0, 5)
    .map((row) => row.course_id)
    .filter(Boolean);

  return [
    {
      id: 'all_courses',
      label: 'All courses',
      description: 'Clear course-specific Learning filters.',
      filters: buildPresetFilters('all_courses', []),
    },
    {
      id: 'high_engagement',
      label: 'High engagement',
      description: 'Focus on the current top engagement courses.',
      filters: buildPresetFilters('high_engagement', sortValues(mostEngagingCourseIds)),
    },
    {
      id: 'dropout_watch',
      label: 'Dropout watch',
      description: 'Focus on courses with the strongest dropout proxy.',
      filters: buildPresetFilters('dropout_watch', sortValues(dropoutWatchCourseIds)),
    },
    {
      id: 'new_learner_activity',
      label: 'New learner activity',
      description: 'Focus on courses with recent learner enrollments.',
      filters: buildPresetFilters('new_learner_activity', sortValues(newLearnerActivityCourseIds)),
    },
  ];
};

const defaultTableState = (table) => ({
  sortKey: table.defaultSort?.key ?? null,
  sortDirection: table.defaultSort?.direction ?? 'desc',
  visibleRows: table.initialVisibleRows ?? 5,
});

const LoadingPanel = ({ title, message }) => (
  <div className="learning-empty-panel glass-panel">
    <h3>{title}</h3>
    <p>{message}</p>
  </div>
);

const LearningExperienceComponent = ({
  active,
  dateRange,
  granularity,
  onDateRangeChange,
  onGranularityChange,
}) => {
  const [normalizedData, setNormalizedData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [learningFilters, setLearningFilters] = useState(EMPTY_FILTERS);
  const [activePreset, setActivePreset] = useState('all_courses');
  const [tableState, setTableState] = useState({});

  useEffect(() => {
    if (!active || normalizedData || error || loading) {
      return;
    }

    const loadLearnWorldsData = async () => {
      try {
        setLoading(true);
        const source = await loadConfiguredLearnWorldsSource();
        const normalized = normalizeLearnWorldsDatasets(source.datasets);
        validateLearnWorldsData(source.datasets, normalized);

        startTransition(() => {
          setNormalizedData(normalized);
          setError(null);
          setLoading(false);
        });
      } catch (loadError) {
        startTransition(() => {
          setError(loadError?.message || 'LearnWorlds data is not available right now.');
          setLoading(false);
        });
      }
    };

    loadLearnWorldsData();
  }, [active, normalizedData, error, loading]);

  const filterOptions = useMemo(() => {
    if (!normalizedData) {
      return {
        courses: [],
        authors: [],
        categories: [],
        accessTypes: [],
      };
    }

    return getLearnWorldsFilterOptions(normalizedData);
  }, [normalizedData]);

  const presetBaseViewModel = useMemo(() => {
    if (!normalizedData) {
      return null;
    }

    return buildLearnWorldsDashboardViewModel(
      normalizedData,
      dateRange,
      granularity
    );
  }, [normalizedData, dateRange, granularity]);

  const presetViews = useMemo(
    () => (presetBaseViewModel ? buildPresetViews(presetBaseViewModel) : []),
    [presetBaseViewModel]
  );

  const filteredLearnWorldsData = useMemo(() => {
    if (!normalizedData || !active) {
      return null;
    }

    return applyLearnWorldsFilters(normalizedData, learningFilters);
  }, [normalizedData, learningFilters, active]);

  const learningViewModel = useMemo(() => {
    if (!filteredLearnWorldsData || !active) {
      return null;
    }

    return buildLearnWorldsDashboardViewModel(
      filteredLearnWorldsData,
      dateRange,
      granularity
    );
  }, [filteredLearnWorldsData, dateRange, granularity, active]);

  useEffect(() => {
    if (!presetViews.length) {
      return;
    }

    const matchedPreset = presetViews.find((preset) => filtersMatch(learningFilters, preset.filters));
    setActivePreset(matchedPreset?.id ?? '');
  }, [learningFilters, presetViews]);

  useEffect(() => {
    if (!learningViewModel) {
      return;
    }

    setTableState((current) => {
      const nextState = { ...current };

      Object.entries(learningViewModel.tables).forEach(([tableId, table]) => {
        if (!nextState[tableId]) {
          nextState[tableId] = defaultTableState(table);
        }
      });

      return nextState;
    });
  }, [learningViewModel]);

  const handleLearningFilterChange = useCallback((updater) => {
    startTransition(() => {
      setLearningFilters((prev) => updater(prev));
    });
  }, []);

  const handlePresetChange = useCallback((presetId) => {
    const preset = presetViews.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    startTransition(() => {
      setActivePreset(preset.id);
      setLearningFilters(preset.filters);
    });
  }, [presetViews]);

  const handleTableStateChange = useCallback((tableId, updater) => {
    setTableState((prev) => ({
      ...prev,
      [tableId]: updater(prev[tableId] ?? {}),
    }));
  }, []);

  if (!active) {
    return null;
  }

  if (loading && !normalizedData) {
    return <LoadingPanel title="Loading Learning data" message="Fetching LearnWorlds metrics..." />;
  }

  if (error && !normalizedData) {
    return <LoadingPanel title="Learning data unavailable" message={error} />;
  }

  if (!learningViewModel) {
    return <LoadingPanel title="Preparing Learning views" message="Building LearnWorlds sections..." />;
  }

  return (
    <>
      <LearningFilters
        filters={learningFilters}
        dateRange={dateRange}
        filterOptions={filterOptions}
        granularity={granularity}
        presets={presetViews}
        activePreset={activePreset}
        onFilterChange={handleLearningFilterChange}
        onDateRangeChange={onDateRangeChange}
        onGranularityChange={onGranularityChange}
        onPresetChange={handlePresetChange}
      />

      <LearningPanel
        learningViewModel={learningViewModel}
        tableState={tableState}
        onTableStateChange={handleTableStateChange}
      />
    </>
  );
};

export default memo(LearningExperienceComponent);
