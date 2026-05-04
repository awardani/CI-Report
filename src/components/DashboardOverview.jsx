import React, { memo, useEffect, useMemo, useState } from 'react';
import DashboardIntercomSection from './DashboardIntercomSection.jsx';
import { ReportPeriodControl } from './ReportPeriodControl.jsx';
import { ThreecoltsUniversitySummarySection } from './ThreecoltsUniversityWorkspace.jsx';
import { INTERCOM_TEAM_GROUPS, resolveIntercomGroupTeams } from '../utils/intercomTeamGroups.js';

const SummaryUnavailable = ({ title, message }) => (
  <div className="learning-empty-panel glass-panel">
    <h3>{title}</h3>
    <p>{message}</p>
  </div>
);

export const DashboardOverview = memo(({
  intercomNormalizedData,
  intercomSourceMeta,
  intercomLoading,
  intercomError,
  learningNormalizedData,
  learningSourceMeta,
  learningLoading,
  learningError,
  sharedDateRange,
  availableTeams,
  comparisonGranularity,
}) => {
  const [intercomSectionDateRange, setIntercomSectionDateRange] = useState(sharedDateRange);
  const [universitySectionDateRange, setUniversitySectionDateRange] = useState(sharedDateRange);
  const [intercomSectionFilters, setIntercomSectionFilters] = useState({
    teamGroup: '',
    team: [],
    teammate: [],
  });

  useEffect(() => {
    setIntercomSectionDateRange(sharedDateRange);
    setUniversitySectionDateRange(sharedDateRange);
  }, [sharedDateRange]);

  const intercomFilters = useMemo(
    () => ({
      ...intercomSectionDateRange,
      ...intercomSectionFilters,
    }),
    [intercomSectionDateRange, intercomSectionFilters]
  );

  const intercomTeamOptions = useMemo(() => ([
    { value: 'all', label: 'All teams' },
    ...INTERCOM_TEAM_GROUPS.map((group) => ({
      value: `group:${group.value}`,
      label: group.label,
    })),
    ...availableTeams.map((team) => ({
      value: `team:${team}`,
      label: team,
    })),
  ]), [availableTeams]);

  const selectedIntercomTeamValue = useMemo(() => {
    if (intercomSectionFilters.teamGroup) {
      return `group:${intercomSectionFilters.teamGroup}`;
    }

    if (intercomSectionFilters.team.length === 1) {
      return `team:${intercomSectionFilters.team[0]}`;
    }

    return 'all';
  }, [intercomSectionFilters.team, intercomSectionFilters.teamGroup]);

  const handleIntercomTeamChange = (event) => {
    const nextValue = event.target.value;

    setIntercomSectionFilters((previous) => {
      if (nextValue === 'all') {
        return {
          ...previous,
          teamGroup: '',
          team: [],
          teammate: [],
        };
      }

      if (nextValue.startsWith('group:')) {
        const teamGroup = nextValue.slice('group:'.length);
        return {
          ...previous,
          teamGroup,
          team: resolveIntercomGroupTeams(teamGroup, availableTeams),
          teammate: [],
        };
      }

      return {
        ...previous,
        teamGroup: '',
        team: [nextValue.slice('team:'.length)],
        teammate: [],
      };
    });
  };

  return (
    <div className="workspace-panel executive-overview">
      <section className="workspace-summary-block">
        <div className="workspace-header-row">
          <div>
            <h2>Intercom</h2>
          </div>
          <div className="workspace-controls-group">
            <label className="workspace-control-field">
              <span>Team</span>
              <select
                value={selectedIntercomTeamValue}
                onChange={handleIntercomTeamChange}
                className="glass-input section-control-select"
              >
                {intercomTeamOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="workspace-control-field">
              <span>Report period</span>
              <ReportPeriodControl
                dateRange={intercomSectionDateRange}
                onDateRangeChange={setIntercomSectionDateRange}
                anchorDate={intercomNormalizedData?.dateBounds?.started_at?.maxDate}
              />
            </div>
          </div>
        </div>

        {intercomLoading && !intercomNormalizedData && (
          <SummaryUnavailable
            title="Loading Intercom"
            message="Fetching Intercom metrics..."
          />
        )}

        {intercomError && !intercomNormalizedData && (
          <SummaryUnavailable
            title="Intercom unavailable"
            message={intercomError}
          />
        )}

        {intercomNormalizedData && (
          <DashboardIntercomSection
            normalizedData={intercomNormalizedData}
            filters={intercomFilters}
            comparisonGranularity={comparisonGranularity}
          />
        )}
      </section>

      <section className="workspace-summary-block">
        <div className="workspace-header-row">
          <div>
            <h2>Threecolts University</h2>
          </div>
          <div className="workspace-controls-group">
            <div className="workspace-control-field">
              <span>Report period</span>
              <ReportPeriodControl
                dateRange={universitySectionDateRange}
                onDateRangeChange={setUniversitySectionDateRange}
                anchorDate={
                  learningNormalizedData?.dateBounds?.progress_activity_at?.maxDate ||
                  learningNormalizedData?.dateBounds?.enrollment_created_at?.maxDate ||
                  learningNormalizedData?.dateBounds?.user_created_at?.maxDate
                }
              />
            </div>
          </div>
        </div>

        {learningLoading && !learningNormalizedData && (
          <SummaryUnavailable
            title="Loading Threecolts University"
            message="Fetching LearnWorlds metrics..."
          />
        )}

        {learningError && !learningNormalizedData && (
          <SummaryUnavailable
            title="Threecolts University unavailable"
            message={learningError}
          />
        )}

        {learningNormalizedData && (
          <ThreecoltsUniversitySummarySection
            normalizedData={learningNormalizedData}
            sharedDateRange={universitySectionDateRange}
            comparisonGranularity={comparisonGranularity}
          />
        )}
      </section>
    </div>
  );
});
