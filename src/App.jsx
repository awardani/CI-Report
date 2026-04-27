import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { DashboardOverview } from './components/DashboardOverview.jsx';
import { IntercomWorkspace } from './components/IntercomWorkspace.jsx';
import { SharedControls } from './components/SharedControls.jsx';
import { SidebarNavigation } from './components/SidebarNavigation.jsx';
import { ThreecoltsUniversityWorkspace } from './components/ThreecoltsUniversityWorkspace.jsx';
import {
  loadConfiguredIntercomSource,
  loadConfiguredLearnWorldsSource,
} from './dataSources/index.js';
import { normalizeLearnWorldsDatasets } from './learnworlds/normalization.js';
import { validateLearnWorldsData } from './learnworlds/validation.js';
import { normalizeIntercomDatasets } from './metrics/normalization';
import { validateIntercomData } from './metrics/validation.js';

const DEFAULT_REPORTING_WINDOW_DAYS = 90;
const SECTION_TITLES = {
  dashboard: 'Dashboard',
  intercom: 'Intercom',
  university: 'Threecolts University',
};

const parseDateInput = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

const getDefaultReportingRange = ({ minDate, maxDate, windowDays = DEFAULT_REPORTING_WINDOW_DAYS }) => {
  const min = parseDateInput(minDate);
  const max = parseDateInput(maxDate);

  if (!min || !max) {
    return {
      startDate: minDate || '',
      endDate: maxDate || '',
    };
  }

  const proposedStart = new Date(max);
  proposedStart.setUTCDate(proposedStart.getUTCDate() - (windowDays - 1));

  const clampedStart = proposedStart < min ? min : proposedStart;

  return {
    startDate: formatDateInput(clampedStart),
    endDate: formatDateInput(max),
  };
};

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [intercomNormalizedData, setIntercomNormalizedData] = useState(null);
  const [learningNormalizedData, setLearningNormalizedData] = useState(null);
  const [intercomLoading, setIntercomLoading] = useState(true);
  const [learningLoading, setLearningLoading] = useState(false);
  const [intercomError, setIntercomError] = useState(null);
  const [learningError, setLearningError] = useState(null);
  const [comparisonGranularity] = useState('monthly');
  const [sharedDateRange, setSharedDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [intercomFilters, setIntercomFilters] = useState({
    teamGroup: '',
    team: [],
    teammate: [],
  });

  const deferredSharedDateRange = useDeferredValue(sharedDateRange);
  const deferredComparisonGranularity = useDeferredValue(comparisonGranularity);
  const deferredIntercomFilters = useDeferredValue(intercomFilters);
  const pageTitle = SECTION_TITLES[activeSection] ?? 'Dashboard';

  useEffect(() => {
    const loadIntercomData = async () => {
      try {
        const source = await loadConfiguredIntercomSource();
        const normalized = normalizeIntercomDatasets(source.datasets);
        validateIntercomData(source.datasets, normalized);

        startTransition(() => {
          setIntercomNormalizedData(normalized);
          setSharedDateRange(getDefaultReportingRange(normalized.dateBounds.started_at));
          setIntercomLoading(false);
        });
      } catch (error) {
        console.error('Failed to load Intercom dashboard data', error);
        setIntercomError(
          'Failed to load dashboard data. Please check the configured Intercom source and environment.'
        );
        setIntercomLoading(false);
      }
    };

    loadIntercomData();
  }, []);

  useEffect(() => {
    if (learningNormalizedData || learningLoading || !['dashboard', 'university'].includes(activeSection)) {
      return;
    }

    const loadLearningData = async () => {
      try {
        setLearningLoading(true);
        const source = await loadConfiguredLearnWorldsSource();
        const normalized = normalizeLearnWorldsDatasets(source.datasets);
        validateLearnWorldsData(source.datasets, normalized);

        startTransition(() => {
          setLearningNormalizedData(normalized);
          setLearningError(null);
          setLearningLoading(false);
        });
      } catch (error) {
        startTransition(() => {
          setLearningError(
            error?.message || 'Threecolts University data is not available right now.'
          );
          setLearningLoading(false);
        });
      }
    };

    loadLearningData();
  }, [activeSection, learningLoading, learningNormalizedData]);

  const handleSidebarChange = useCallback((nextSection) => {
    startTransition(() => {
      setActiveSection(nextSection);
    });
  }, []);

  const handleSharedDateRangeChange = useCallback((updater) => {
    startTransition(() => {
      setSharedDateRange(updater);
    });
  }, []);

  const handleIntercomFilterChange = useCallback((updater) => {
    startTransition(() => {
      setIntercomFilters(updater);
    });
  }, []);

  if (intercomLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: '#94a3b8' }}>Loading metrics...</p>
      </div>
    );
  }

  if (intercomError) {
    return (
      <div className="loading-screen">
        <p style={{ color: '#ef4444' }}>{intercomError}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper app-frame">
      <SpeedInsights />
      <main className="app-shell integrated-shell">
        <SidebarNavigation
          activeSection={activeSection}
          onChange={handleSidebarChange}
        />

        <section className="content-shell">
          <div className="workspace-body">
            <header className="workspace-topbar">
              <div className="workspace-topbar-title">
                <h1>{pageTitle}</h1>
              </div>
              <SharedControls
                dateRange={sharedDateRange}
                onDateRangeChange={handleSharedDateRangeChange}
              />
            </header>

            {activeSection === 'dashboard' && (
              <DashboardOverview
                intercomNormalizedData={intercomNormalizedData}
                learningNormalizedData={learningNormalizedData}
                learningLoading={learningLoading}
                learningError={learningError}
                sharedDateRange={deferredSharedDateRange}
                comparisonGranularity={deferredComparisonGranularity}
              />
            )}

            {activeSection === 'intercom' && (
            <IntercomWorkspace
              normalizedData={intercomNormalizedData}
              availableTeams={intercomNormalizedData.availableTeams}
              availableTeammates={intercomNormalizedData.availableTeammates}
              sharedFilters={deferredSharedDateRange}
              localFilters={deferredIntercomFilters}
              onLocalFilterChange={handleIntercomFilterChange}
              comparisonGranularity={deferredComparisonGranularity}
            />
            )}

            {activeSection === 'university' && (
              <ThreecoltsUniversityWorkspace
                normalizedData={learningNormalizedData}
                loading={learningLoading}
                error={learningError}
                sharedDateRange={deferredSharedDateRange}
                comparisonGranularity={deferredComparisonGranularity}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
