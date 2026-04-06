import React, { useState, useEffect, useMemo } from 'react';
import { KeyMetrics } from './components/KeyMetrics';
import { Charts } from './components/Charts';
import { Filters } from './components/Filters';
import { CsatReport } from './components/CsatReport';
import { parseCSV, processData, parseCSAT, parseFinData, processFinStats } from './utils/csvParser';

function App() {
  const [appData, setAppData] = useState(null);
  const [csatData, setCsatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [finData, setFinData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    team: '',
    teammate: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [result, csatResult, finResult] = await Promise.all([
          parseCSV('/data.csv'),
          parseCSAT('/csat.csv'),
          parseFinData('/fin_deflection.csv', '/fin_resolution.csv')
        ]);
        
        setAppData(result);
        setCsatData(csatResult);
        setFinData(finResult);
        
        // Initialize default dates
        setFilters(prev => ({
          ...prev,
          startDate: result.dateBounds.minDate,
          endDate: result.dateBounds.maxDate
        }));
        
        setLoading(false);
      } catch (err) {
        console.error("Failed to parse CSV", err);
        setError("Failed to load customer support data. Please ensure data.csv exists.");
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const data = useMemo(() => {
    if (!appData) return null;
    return processData(appData.rawData, filters);
  }, [appData, filters]);

  const finProcessedData = useMemo(() => {
    if (!finData) return null;
    return processFinStats(finData.deflectionData, finData.resolutionData, filters);
  }, [finData, filters]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: '#94a3b8' }}>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <p style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      <header className="top-banner">
        <div className="max-w-container">
          <h1>Dashboard</h1>
        </div>
      </header>
      
      <main className="max-w-container main-content">
        <Filters 
          availableTeams={appData.availableTeams}
          availableTeammates={appData.availableTeammates}
          filters={filters}
          onFilterChange={setFilters}
        />
        <KeyMetrics metrics={data.metrics} finMetrics={finProcessedData?.metrics} />
        <Charts charts={data.charts} finCharts={finProcessedData?.charts} />
        {csatData && <CsatReport csatData={csatData} />}
      </main>
    </div>
  );
}

export default App;
