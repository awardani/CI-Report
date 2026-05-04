import React, { memo, useEffect, useMemo, useState } from 'react';
import { buildInitiativesViewModel } from '../initiatives/viewModel.js';

const FILTER_KEYS = ['owner', 'type', 'source', 'severity', 'trend'];

const FILTER_DEFAULTS = {
  owner: 'all',
  type: 'all',
  source: 'all',
  severity: 'all',
  trend: 'all',
};

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const TREND_LABELS = {
  increasing: 'Trending up',
  stable: 'Flat',
  decreasing: 'Trending down',
};

const readFiltersFromUrl = () => {
  if (typeof window === 'undefined') {
    return FILTER_DEFAULTS;
  }

  const params = new URLSearchParams(window.location.search);

  return FILTER_KEYS.reduce((accumulator, key) => {
    accumulator[key] = params.get(key) || FILTER_DEFAULTS[key];
    return accumulator;
  }, {});
};

const writeFiltersToUrl = (filters) => {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);

  FILTER_KEYS.forEach((key) => {
    if (!filters[key] || filters[key] === 'all') {
      params.delete(key);
    } else {
      params.set(key, filters[key]);
    }
  });

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
};

const sortByPriority = (initiatives) =>
  [...initiatives].sort((left, right) => {
    if ((right.impactScore || 0) !== (left.impactScore || 0)) {
      return (right.impactScore || 0) - (left.impactScore || 0);
    }

    if ((PRIORITY_ORDER[left.priority] ?? 99) !== (PRIORITY_ORDER[right.priority] ?? 99)) {
      return (PRIORITY_ORDER[left.priority] ?? 99) - (PRIORITY_ORDER[right.priority] ?? 99);
    }

    return (right.impact?.volume || 0) - (left.impact?.volume || 0);
  });

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'No signal';
  }

  return `${Number(value).toFixed(1)}%`;
};

const formatTrendDelta = (initiative) => {
  const symbol =
    initiative.trendDirection === 'increasing'
      ? '↑'
      : initiative.trendDirection === 'decreasing'
        ? '↓'
        : '→';

  return `${symbol} ${Math.abs(initiative.trendDelta || 0)}`;
};

const buildBriefText = (initiative) => {
  if (!initiative) {
    return '';
  }

  const matches = initiative.content?.matches || [];
  const gaps = initiative.content?.gaps || [];
  const actions = initiative.rankedActions || [];

  return [
    initiative.issueSummary || initiative.problem?.summary || initiative.title,
    '',
    `Owner: ${initiative.ownerTeamLabel}`,
    `Improvement type: ${initiative.improvementTypeLabel}`,
    `Impact: ${initiative.impactLine}`,
    `Sources: ${initiative.sourceSummary}`,
    '',
    'Clustered user phrasing:',
    ...(initiative.userPhrasing?.map((phrase) => `- ${phrase}`) || []),
    '',
    'Existing coverage:',
    ...(matches.length > 0 ? matches.map((item) => `- ${item.title}`) : ['- No matched content']),
    '',
    'Coverage gaps:',
    ...(gaps.length > 0 ? gaps.map((gap) => `- ${gap}`) : ['- No named gaps']),
    '',
    'Recommended actions:',
    ...(actions.length > 0
      ? actions.map((action) => `- ${action.rank}: ${action.text} (~${formatNumber(action.estimatedDeflection)} deflection)`)
      : ['- No actions']),
  ].join('\n');
};

const sendToOwner = (initiative) => {
  const subject = encodeURIComponent(`AI Recommendation: ${initiative.issueSummary || initiative.title}`);
  const body = encodeURIComponent(buildBriefText(initiative));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

const copyBrief = async (initiative) => {
  const brief = buildBriefText(initiative);

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(brief);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = brief;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const FilterChipGroup = memo(({ label, options, value, onChange }) => (
  <div className="ai-recommendations-filter-group">
    <span className="ai-recommendations-filter-label">{label}</span>
    <div className="ai-recommendations-chip-row">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`ai-recommendations-filter-chip ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
));

const KpiCard = memo(({ label, value, detail, tone = 'default' }) => (
  <div className={`ai-recommendations-kpi-card ${tone}`}>
    <p>{label}</p>
    <strong>{value}</strong>
    <span>{detail}</span>
  </div>
));

const RecommendationRow = memo(({ initiative, isSelected, onSelect }) => (
  <button
    type="button"
    className={`ai-recommendations-feed-row ${initiative.priority} ${isSelected ? 'active' : ''}`}
    onClick={() => onSelect(initiative.initiative_id)}
  >
    <div className="ai-recommendations-feed-stripe" />
    <div className="ai-recommendations-feed-copy">
      <div className="ai-recommendations-feed-chips">
        <span className={`initiative-priority-pill ${initiative.priority}`}>{initiative.priority}</span>
        <span className="ai-recommendations-meta-chip">{initiative.improvementTypeLabel}</span>
        <span className="ai-recommendations-meta-chip">{initiative.sourceSummary}</span>
        <span className="ai-recommendations-meta-chip">{initiative.ownerTeamLabel}</span>
      </div>
      <h3>{initiative.issueSummary || initiative.problem?.summary || initiative.title}</h3>
      <p>{initiative.impactLine}</p>
    </div>
  </button>
));

const EvidenceCard = memo(({ title, hasSignal, lines, note }) => (
  <div className="ai-recommendations-evidence-card">
    <p className="ai-recommendations-section-eyebrow">{title}</p>
    {hasSignal ? (
      <>
        <div className="ai-recommendations-evidence-lines">
          {lines.map((line) => (
            <p key={line.label}>
              <span>{line.label}</span>
              <strong>{line.value}</strong>
            </p>
          ))}
        </div>
        {note ? <div className="ai-recommendations-evidence-note">{note}</div> : null}
      </>
    ) : (
      <div className="ai-recommendations-no-signal">No signal available for this source yet.</div>
    )}
  </div>
));

const RecommendationDetail = memo(({ initiative }) => {
  const [copyState, setCopyState] = useState('idle');

  if (!initiative) {
    return (
      <section className="ai-recommendations-detail glass-panel">
        <div className="ai-recommendations-empty-state">
          Select a recommendation from the feed to review the cross-source evidence.
        </div>
      </section>
    );
  }

  const matches = initiative.content?.matches || [];
  const gaps = initiative.content?.gaps || [];
  const actions = initiative.rankedActions || [];

  const handleCopy = async () => {
    try {
      await copyBrief(initiative);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch (error) {
      console.error('Failed to copy recommendation brief', error);
      setCopyState('idle');
    }
  };

  const intercomLines = [
    { label: 'Volume', value: `${formatNumber(initiative.intercomEvidence?.volume)} conversations` },
    {
      label: 'Trend',
      value: `${TREND_LABELS[initiative.intercomEvidence?.trendDirection] || 'Flat'} · ${Math.abs(
        initiative.intercomEvidence?.trendDelta || 0
      )}`,
    },
    {
      label: 'AHT',
      value:
        initiative.intercomEvidence?.averageHandleTimeMinutes !== null &&
        initiative.intercomEvidence?.averageHandleTimeMinutes !== undefined
          ? `${initiative.intercomEvidence.averageHandleTimeMinutes}m`
          : 'No signal',
    },
    {
      label: 'CSAT',
      value:
        initiative.intercomEvidence?.csatPercent !== null &&
        initiative.intercomEvidence?.csatPercent !== undefined
          ? `${initiative.intercomEvidence.csatPercent}% positive`
          : 'No signal',
    },
  ];

  const learnWorldsLines = [
    {
      label: 'Surface',
      value: initiative.learnWorldsEvidence?.surfaceLabel || 'No signal',
    },
    {
      label: 'Completion',
      value: formatPercent(initiative.learnWorldsEvidence?.completionPercent),
    },
    {
      label: 'Quiz fail rate',
      value: formatPercent(initiative.learnWorldsEvidence?.quizFailRate),
    },
    {
      label: 'Video performance',
      value:
        initiative.learnWorldsEvidence?.relatedVideoPerformance !== null &&
        initiative.learnWorldsEvidence?.relatedVideoPerformance !== undefined
          ? formatNumber(initiative.learnWorldsEvidence.relatedVideoPerformance)
          : 'No signal',
    },
  ];

  return (
    <section className="ai-recommendations-detail glass-panel">
      <div className="ai-recommendations-detail-header">
        <div className="ai-recommendations-feed-chips">
          <span className={`initiative-priority-pill ${initiative.priority}`}>{initiative.priority}</span>
          <span className="ai-recommendations-meta-chip">{initiative.improvementTypeLabel}</span>
          <span className="ai-recommendations-meta-chip">{initiative.sourceSummary}</span>
          <span className="ai-recommendations-meta-chip">{initiative.ownerTeamLabel}</span>
        </div>
        <h2>{initiative.issueSummary || initiative.problem?.summary || initiative.title}</h2>
        <p className="ai-recommendations-correlation-copy">
          This recommendation ties together {initiative.sourceSummary.toLowerCase()} signals around the same friction
          pattern, so the recommendation is the cross-source correlation itself, not a coincidence.
        </p>
      </div>

      <div className="ai-recommendations-evidence-grid">
        <EvidenceCard
          title="Intercom signal"
          hasSignal={initiative.intercomEvidence?.hasSignal}
          lines={intercomLines}
          note={initiative.intercomEvidence?.note}
        />
        <EvidenceCard
          title="LearnWorlds signal"
          hasSignal={initiative.learnWorldsEvidence?.hasSignal}
          lines={learnWorldsLines}
          note={initiative.learnWorldsEvidence?.note}
        />
      </div>

      <div className="ai-recommendations-detail-columns">
        <div className="ai-recommendations-detail-section">
          <p className="ai-recommendations-section-eyebrow">Real user phrasing</p>
          <div className="ai-recommendations-quote-card">
            {(initiative.userPhrasing || initiative.problem?.examples || []).slice(0, 3).map((phrase) => (
              <p key={phrase}>"{phrase}"</p>
            ))}
          </div>

          <p className="ai-recommendations-section-eyebrow">Existing coverage</p>
          {matches.length > 0 ? (
            <ul className="ai-recommendations-bullet-list">
              {matches.map((item) => (
                <li key={`${item.title}-${item.type}`}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}{' '}
                  ({item.type === 'course' ? 'course' : 'article'})
                </li>
              ))}
            </ul>
          ) : (
            <p className="ai-recommendations-muted-copy">No matched coverage yet.</p>
          )}
        </div>

        <div className="ai-recommendations-detail-section">
          <p className="ai-recommendations-section-eyebrow">Coverage gaps</p>
          {gaps.length > 0 ? (
            <ul className="ai-recommendations-bullet-list">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          ) : (
            <p className="ai-recommendations-muted-copy">No named gaps for this recommendation.</p>
          )}

          <p className="ai-recommendations-section-eyebrow">Recommended actions</p>
          <div className="ai-recommendations-action-stack">
            {actions.map((action) => (
              <div key={`${action.rank}-${action.text}`} className="ai-recommendations-action-card">
                <p>
                  <strong>{action.rank}:</strong> {action.text}
                </p>
                <span>Estimated deflection: {formatNumber(action.estimatedDeflection)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-recommendations-detail-actions">
        <button type="button" className="glass-button" onClick={handleCopy}>
          {copyState === 'copied' ? 'Copied brief' : 'Copy brief ↗'}
        </button>
        <button type="button" className="glass-button" onClick={() => sendToOwner(initiative)}>
          Send to owner ↗
        </button>
      </div>
    </section>
  );
});

export const AIRecommendationsPage = memo(({
  intercomNormalizedData,
  intercomSourceMeta,
  learningNormalizedData,
  learningSourceMeta,
  sharedDateRange,
  comparisonGranularity,
}) => {
  const viewModel = useMemo(
    () =>
      buildInitiativesViewModel({
        intercomNormalizedData,
        intercomSourceMeta,
        learnWorldsNormalizedData: learningNormalizedData,
        learnWorldsSourceMeta: learningSourceMeta,
        filters: sharedDateRange,
        comparisonGranularity,
      }),
    [
      intercomNormalizedData,
      intercomSourceMeta,
      learningNormalizedData,
      learningSourceMeta,
      sharedDateRange,
      comparisonGranularity,
    ]
  );

  const initiatives = useMemo(() => sortByPriority(viewModel?.initiatives || []), [viewModel]);
  const [filters, setFilters] = useState(readFiltersFromUrl);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState(initiatives[0]?.initiative_id || null);

  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  const filterOptions = useMemo(() => {
    const sourceOptions = initiatives.flatMap((initiative) => initiative.sourceSurfaces || []);
    const uniqueSources = [...new Map(sourceOptions.map((item) => [item.key, item])).values()];

    return {
      owner: [
        { value: 'all', label: 'Any owner' },
        { value: 'support', label: 'Support' },
        { value: 'content', label: 'Content' },
        { value: 'education', label: 'Education' },
        { value: 'product_ops', label: 'Product / Ops' },
      ],
      type: [
        { value: 'all', label: 'Any type' },
        ...[...new Map(
          initiatives.map((initiative) => [
            initiative.improvementType,
            {
              value: initiative.improvementType,
              label: initiative.improvementTypeLabel,
            },
          ])
        ).values()],
      ],
      source: [{ value: 'all', label: 'Any source' }, ...uniqueSources.map((item) => ({ value: item.key, label: item.label }))],
      severity: [
        { value: 'all', label: 'Any severity' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ],
      trend: [
        { value: 'all', label: 'Any trend' },
        { value: 'increasing', label: 'Trending up' },
        { value: 'stable', label: 'Flat' },
        { value: 'decreasing', label: 'Trending down' },
      ],
    };
  }, [initiatives]);

  const filteredInitiatives = useMemo(
    () =>
      initiatives.filter((initiative) => {
        if (filters.owner !== 'all' && initiative.ownerTeam !== filters.owner) {
          return false;
        }

        if (filters.type !== 'all' && initiative.improvementType !== filters.type) {
          return false;
        }

        if (
          filters.source !== 'all' &&
          !(initiative.sourceSurfaces || []).some((surface) => surface.key === filters.source)
        ) {
          return false;
        }

        if (filters.severity !== 'all' && initiative.priority !== filters.severity) {
          return false;
        }

        if (filters.trend !== 'all' && initiative.trendDirection !== filters.trend) {
          return false;
        }

        return true;
      }),
    [filters, initiatives]
  );

  useEffect(() => {
    if (!filteredInitiatives.length) {
      setSelectedInitiativeId(null);
      return;
    }

    const stillExists = filteredInitiatives.some(
      (initiative) => initiative.initiative_id === selectedInitiativeId
    );

    if (!stillExists) {
      setSelectedInitiativeId(filteredInitiatives[0].initiative_id);
    }
  }, [filteredInitiatives, selectedInitiativeId]);

  const selectedInitiative =
    filteredInitiatives.find((initiative) => initiative.initiative_id === selectedInitiativeId) ||
    filteredInitiatives[0] ||
    null;

  const kpis = useMemo(() => {
    const openRecommendations = filteredInitiatives.length;
    const trendingUp = filteredInitiatives.filter((initiative) => initiative.trendDirection === 'increasing').length;
    const highPriorityCount = filteredInitiatives.filter((initiative) => initiative.priority === 'high').length;
    const highPriorityTrending = filteredInitiatives.filter(
      (initiative) => initiative.priority === 'high' && initiative.trendDirection === 'increasing'
    ).length;
    const coverageGapPercent = openRecommendations
      ? Math.round(
          filteredInitiatives.reduce((sum, initiative) => sum + (initiative.coverageGapPercent || 0), 0) /
            openRecommendations
        )
      : 0;
    const estimatedDeflection = filteredInitiatives.reduce(
      (sum, initiative) => sum + (initiative.estimatedDeflection || 0),
      0
    );

    return {
      openRecommendations,
      trendingUp,
      highPriorityCount,
      highPriorityTrending,
      coverageGapPercent,
      estimatedDeflection,
    };
  }, [filteredInitiatives]);

  return (
    <div className="ai-recommendations-page">
      <div className="ai-recommendations-header">
        <div>
          <h1>Customer Insight Hub</h1>
          <p>
            Last 30 days · Cross-source recommendations from Intercom and LearnWorlds, prioritized for content,
            workflow, onboarding, and product improvement.
          </p>
        </div>
      </div>

      <div className="ai-recommendations-kpi-grid">
        <KpiCard
          label="Open recommendations"
          value={formatNumber(kpis.openRecommendations)}
          detail={`+${kpis.trendingUp} trending up`}
        />
        <KpiCard
          label="High priority"
          value={formatNumber(kpis.highPriorityCount)}
          detail={`${kpis.highPriorityTrending} still climbing`}
          tone="danger"
        />
        <KpiCard
          label="Coverage gap"
          value={`${kpis.coverageGapPercent}%`}
          detail="Weighted missing or partial coverage"
        />
        <KpiCard
          label="Est. total deflection"
          value={formatNumber(kpis.estimatedDeflection)}
          detail="If the filtered recommendations ship"
        />
      </div>

      <section className="ai-recommendations-filter-bar glass-panel">
        <FilterChipGroup
          label="Owner"
          options={filterOptions.owner}
          value={filters.owner}
          onChange={(value) => setFilters((current) => ({ ...current, owner: value }))}
        />
        <FilterChipGroup
          label="Improvement type"
          options={filterOptions.type}
          value={filters.type}
          onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
        />
        <FilterChipGroup
          label="Source surface"
          options={filterOptions.source}
          value={filters.source}
          onChange={(value) => setFilters((current) => ({ ...current, source: value }))}
        />
        <FilterChipGroup
          label="Severity"
          options={filterOptions.severity}
          value={filters.severity}
          onChange={(value) => setFilters((current) => ({ ...current, severity: value }))}
        />
        <FilterChipGroup
          label="Trend"
          options={filterOptions.trend}
          value={filters.trend}
          onChange={(value) => setFilters((current) => ({ ...current, trend: value }))}
        />
      </section>

      <div className="ai-recommendations-layout">
        <section className="ai-recommendations-feed glass-panel">
          <div className="ai-recommendations-feed-header">
            <p className="initiative-eyebrow">
              Recommendation feed ({filteredInitiatives.filter((item) => item.priority === 'high').length} high ·{' '}
              {filteredInitiatives.filter((item) => item.priority === 'medium').length} medium ·{' '}
              {filteredInitiatives.filter((item) => item.priority === 'low').length} low)
            </p>
          </div>

          {filteredInitiatives.length > 0 ? (
            <div className="ai-recommendations-feed-list">
              {filteredInitiatives.map((initiative) => (
                <RecommendationRow
                  key={initiative.initiative_id}
                  initiative={initiative}
                  isSelected={selectedInitiative?.initiative_id === initiative.initiative_id}
                  onSelect={setSelectedInitiativeId}
                />
              ))}
            </div>
          ) : (
            <div className="ai-recommendations-empty-state">
              No recommendations match this filter combination right now.
            </div>
          )}
        </section>

        <RecommendationDetail initiative={selectedInitiative} />
      </div>
    </div>
  );
});

export default AIRecommendationsPage;
