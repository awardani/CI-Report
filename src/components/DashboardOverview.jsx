import React, { memo } from 'react';
import { IntercomOverviewSection } from './IntercomWorkspace.jsx';
import { ThreecoltsUniversitySummarySection } from './ThreecoltsUniversityWorkspace.jsx';

const SummaryUnavailable = ({ title, message }) => (
  <div className="learning-empty-panel glass-panel">
    <h3>{title}</h3>
    <p>{message}</p>
  </div>
);

export const DashboardOverview = memo(({
  intercomNormalizedData,
  learningNormalizedData,
  learningLoading,
  learningError,
  sharedDateRange,
  comparisonGranularity,
}) => (
  <div className="workspace-panel executive-overview">
    <section className="workspace-summary-block">
      <div className="workspace-header-row">
        <div>
          <h2>Intercom</h2>
        </div>
      </div>

      <IntercomOverviewSection
        normalizedData={intercomNormalizedData}
        filters={sharedDateRange}
        comparisonGranularity={comparisonGranularity}
        showCsatBreakdown={false}
      />
    </section>

    <section className="workspace-summary-block">
      <div className="workspace-header-row">
        <div>
          <h2>Threecolts University</h2>
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
          sharedDateRange={sharedDateRange}
          comparisonGranularity={comparisonGranularity}
        />
      )}
    </section>
  </div>
));
