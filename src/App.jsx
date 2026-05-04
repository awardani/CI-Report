import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from 'react';
import { DashboardOverview } from './components/DashboardOverview.jsx';
import IntercomWorkspace from './components/IntercomWorkspace.jsx';
import { SidebarNavigation } from './components/SidebarNavigation.jsx';
import { AIRecommendationsPage } from './pages/AIRecommendationsPage.jsx';
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
  'ai-recommendations': 'AI Recommendations',
};

const PATH_TO_SECTION = {
  '/': 'dashboard',
  '/intercom': 'intercom',
  '/ai-recommendations': 'ai-recommendations',
};

const SECTION_TO_PATH = {
  dashboard: '/',
  intercom: '/intercom',
  'ai-recommendations': '/ai-recommendations',
};

const resolveSectionFromPath = (pathname) => PATH_TO_SECTION[pathname] || 'dashboard';

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

const scheduleBackgroundLoad = (callback) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }

  const timeoutId = window.setTimeout(callback, 250);
  return () => window.clearTimeout(timeoutId);
};

function App() {
  const [activeSection, setActiveSection] = useState(() =>
    typeof window === 'undefined' ? 'dashboard' : resolveSectionFromPath(window.location.pathname)
  );
  const [intercomNormalizedData, setIntercomNormalizedData] = useState(null);
  const [learningNormalizedData, setLearningNormalizedData] = useState(null);
  const [intercomSourceMeta, setIntercomSourceMeta] = useState(null);
  const [learningSourceMeta, setLearningSourceMeta] = useState(null);
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

        if (!source) {
          throw new Error('Intercom datasets not found.');
        }

        const normalized = normalizeIntercomDatasets(source.datasets);
        validateIntercomData(source.datasets, normalized);

        startTransition(() => {
          setIntercomNormalizedData(normalized);
          setIntercomSourceMeta(source.meta ?? null);
          setSharedDateRange(getDefaultReportingRange(normalized.dateBounds.started_at));
          setIntercomError(null);
          setIntercomLoading(false);
        });
      } catch (error) {
        console.error('Failed to load Intercom dashboard data', error);
        startTransition(() => {
          setIntercomError(
            error?.message ||
              'Intercom data is not available right now. The rest of the dashboard can still load.'
          );
          setIntercomLoading(false);
        });
      }
    };

    loadIntercomData();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setActiveSection(resolveSectionFromPath(window.location.pathname));
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLearningData = async ({ mode, preserveExistingDataOnError = true }) => {
      try {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLearningLoading(true);
        });
        const source = await loadConfiguredLearnWorldsSource({ mode });

        if (cancelled) {
          return;
        }

        if (!source) {
          startTransition(() => {
            setLearningNormalizedData(null);
            setLearningSourceMeta(null);
            setLearningError(null);
            setLearningLoading(false);
          });
          return;
        }

        if (!source.datasets) {
          throw new Error('Threecolts University datasets not found.');
        }

        const normalized = normalizeLearnWorldsDatasets(source.datasets);
        validateLearnWorldsData(source.datasets, normalized);

        startTransition(() => {
          setLearningNormalizedData(normalized);
          setLearningSourceMeta(source.meta ?? null);
          setLearningError(null);
          setLearningLoading(false);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          if (!preserveExistingDataOnError || !learningNormalizedData) {
            setLearningError(
              error?.message || 'Threecolts University data is not available right now.'
            );
          }
          setLearningLoading(false);
        });
      }
    };

    const cancelScheduledLoad = scheduleBackgroundLoad(() => {
      loadLearningData({ mode: 'snapshot' });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  const handleSidebarChange = useCallback((nextSection) => {
    const nextPath = SECTION_TO_PATH[nextSection] || '/';

    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

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

  if (intercomLoading && learningLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: '#94a3b8' }}>Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper app-frame">
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
            </header>

            {activeSection === 'dashboard' && (
              <DashboardOverview
                intercomNormalizedData={intercomNormalizedData}
                intercomSourceMeta={intercomSourceMeta}
                intercomLoading={intercomLoading}
                intercomError={intercomError}
                learningNormalizedData={learningNormalizedData}
                learningSourceMeta={learningSourceMeta}
                learningLoading={learningLoading}
                learningError={learningError}
                sharedDateRange={deferredSharedDateRange}
                availableTeams={intercomNormalizedData?.availableTeams || []}
                comparisonGranularity={deferredComparisonGranularity}
              />
            )}

            {activeSection === 'intercom' && (
            <IntercomWorkspace
              normalizedData={intercomNormalizedData}
              error={intercomError}
              loading={intercomLoading}
              availableTeams={intercomNormalizedData?.availableTeams || []}
              sharedFilters={deferredSharedDateRange}
              localFilters={deferredIntercomFilters}
              onLocalFilterChange={handleIntercomFilterChange}
              onSharedDateRangeChange={handleSharedDateRangeChange}
              comparisonGranularity={deferredComparisonGranularity}
            />
            )}

            {activeSection === 'ai-recommendations' && (
              <AIRecommendationsPage
                intercomNormalizedData={intercomNormalizedData}
                intercomSourceMeta={intercomSourceMeta}
                learningNormalizedData={learningNormalizedData}
                learningSourceMeta={learningSourceMeta}
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
