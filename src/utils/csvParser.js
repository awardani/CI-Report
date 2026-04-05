import Papa from 'papaparse';

export const parseCSV = (fileOrUrl) => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrUrl, {
      download: typeof fileOrUrl === 'string',
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data;
        const availableTeams = [...new Set(rawData.map(row => row['Team currently assigned']).filter(Boolean))].sort();
        const availableTeammates = [...new Set(rawData.map(row => row['Teammate currently assigned']).filter(Boolean))].sort();
        
        let minDate = '';
        let maxDate = '';
        if (rawData.length > 0) {
          const dates = rawData
            .map(row => {
              const str = row['Conversation started at (America/New_York)'];
              return str ? new Date(str.split(' ')[0]).getTime() : null;
            })
            .filter(Boolean);
          
          if (dates.length > 0) {
            minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
            maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
          }
        }
        
        resolve({ rawData, availableTeams, availableTeammates, dateBounds: { minDate, maxDate } });
      },
      error: (err) => reject(err)
    });
  });
};

export const parseCSAT = (fileOrUrl) => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrUrl, {
      download: typeof fileOrUrl === 'string',
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (err) => reject(err)
    });
  });
};

export const processData = (rawData, filters = {}) => {
  const filteredData = rawData.filter(row => {
    const sDateRaw = row['Conversation started at (America/New_York)'];
    if (!sDateRaw) return false;
    const sDateIso = sDateRaw.split(' ')[0];
    
    if (filters.startDate && sDateIso < filters.startDate) return false;
    if (filters.endDate && sDateIso > filters.endDate) return false;
    if (filters.team && row['Team currently assigned'] !== filters.team) return false;
    if (filters.teammate && row['Teammate currently assigned'] !== filters.teammate) return false;
    return true;
  });

  let totalConversations = filteredData.length;
  let csatRatings = [];
  let firstResponseTimes = [];
  
  let ticketsByChannel = {};
  let ticketsByType = {};
  let conversationsByDate = {};
  let topicsCount = {};

  filteredData.forEach(row => {
    // 1. Process Dates for Trend
    const startedAtRaw = row['Conversation started at (America/New_York)'];
    if (startedAtRaw) {
      const date = startedAtRaw.split(' ')[0];
      conversationsByDate[date] = (conversationsByDate[date] || 0) + 1;
    }

    // 2. Process CSAT
    const cxRating = parseInt(row['CX Score rating']);
    const tmRating = parseInt(row['Last teammate rating']);
    const botRating = parseInt(row['Last chatbot rating']);
    let rating = tmRating || cxRating || botRating || null;
    if (rating && !isNaN(rating)) {
      csatRatings.push(rating);
    }

    // 3. Process First Response Time
    const frt = parseInt(row['First response time (seconds)']);
    if (!isNaN(frt)) {
      firstResponseTimes.push(frt);
    }

    // 4. Process Channels
    const channel = row['Channel'] || 'Unknown';
    ticketsByChannel[channel] = (ticketsByChannel[channel] || 0) + 1;

    // 5. Process Ticket Types
    const type = row['Ticket type'] || 'Unknown';
    if (type !== 'Unknown' && type !== '') {
      ticketsByType[type] = (ticketsByType[type] || 0) + 1;
    }

    // 6. Process Topics (Prefer AI Topic, fallback to Topics)
    const topicStr = row['AI Topic'] || row['Topics'];
    if (topicStr && topicStr.trim() !== '') {
      const topics = topicStr.split(',').map(t => t.trim()).filter(Boolean);
      topics.forEach(t => {
        topicsCount[t] = (topicsCount[t] || 0) + 1;
      });
    }
  });

  const avgCsat = csatRatings.length 
    ? (csatRatings.reduce((a, b) => a + b, 0) / csatRatings.length).toFixed(1)
    : 0;
  
  const avgFrtSeconds = firstResponseTimes.length
    ? (firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length)
    : 0;
    
  let avgFrtStr = "N/A";
  if (avgFrtSeconds > 0) {
    const hours = Math.floor(avgFrtSeconds / 3600);
    const minutes = Math.floor((avgFrtSeconds % 3600) / 60);
    avgFrtStr = `${hours}h ${minutes}m`;
  }

  const trendData = Object.keys(conversationsByDate)
    .sort()
    .map(date => ({ date, Conversations: conversationsByDate[date] }));

  const channelData = Object.keys(ticketsByChannel)
    .map(name => ({ name, value: ticketsByChannel[name] }))
    .sort((a, b) => b.value - a.value);

  const typeData = Object.keys(ticketsByType)
    .map(name => ({ name, value: ticketsByType[name] }))
    .sort((a, b) => b.value - a.value);

  let csatBreakdownObj = { '1 Star': 0, '2 Stars': 0, '3 Stars': 0, '4 Stars': 0, '5 Stars': 0 };
  csatRatings.forEach(r => {
    if (r >= 1 && r <= 5) {
      csatBreakdownObj[`${r} Star${r > 1 ? 's' : ''}`] += 1;
    }
  });
  
  const csatData = Object.keys(csatBreakdownObj)
    .map(name => ({ name, value: csatBreakdownObj[name] }))
    .filter(item => item.value > 0);

  const topTopicsData = Object.keys(topicsCount)
    .map(name => ({ name, value: topicsCount[name] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    metrics: { totalConversations, avgCsat, avgFrtStr, totalRatings: csatRatings.length },
    charts: { trendData, channelData, typeData, csatData, topTopicsData }
  };
};

export const parseFinData = (deflectionString, resolutionString) => {
  return new Promise((resolve, reject) => {
    Papa.parse(deflectionString, {
      download: typeof deflectionString === 'string' && (deflectionString.endsWith('.csv') || deflectionString.startsWith('/')),
      header: true,
      skipEmptyLines: true,
      complete: (defRes) => {
        Papa.parse(resolutionString, {
          download: typeof resolutionString === 'string' && (resolutionString.endsWith('.csv') || resolutionString.startsWith('/')),
          header: true,
          skipEmptyLines: true,
          complete: (resRes) => {
            resolve({ deflectionData: defRes.data, resolutionData: resRes.data });
          },
          error: (err) => reject(err)
        });
      },
      error: (err) => reject(err)
    });
  });
};

export const processFinStats = (deflectionData, resolutionData, filters = {}) => {
  const filterByDate = (row) => {
    const sDateRaw = row['Conversation started at (America/New_York)'];
    if (!sDateRaw) return false;
    const sDateIso = sDateRaw.split(' ')[0];
    if (filters.startDate && sDateIso < filters.startDate) return false;
    if (filters.endDate && sDateIso > filters.endDate) return false;
    return true;
  };
  
  const filteredDeflection = deflectionData.filter(filterByDate);
  const filteredResolution = resolutionData.filter(filterByDate);

  let deflectionCount = 0;
  let topTopicsCount = {};
  
  filteredDeflection.forEach(row => {
    if (row['Fin AI Agent deflected'] === 'true') {
      deflectionCount++;
    }
    const topic = row['AI Topic'];
    if (topic && topic.trim() !== '') {
      topTopicsCount[topic] = (topTopicsCount[topic] || 0) + 1;
    }
  });

  const topFinTopicsData = Object.keys(topTopicsCount)
    .map(name => ({ name, value: topTopicsCount[name] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
    
  let resolutionCount = 0;
  filteredResolution.forEach(row => {
    const state = row['Fin AI Agent resolution state'];
    if (state === 'Assumed resolved' || state === 'Confirmed resolved') {
      resolutionCount++;
    }
  });

  const agentResolutionRate = deflectionCount > 0 
    ? ((resolutionCount / deflectionCount) * 100).toFixed(1)
    : '0';
    
  return {
    metrics: { deflectionCount, agentResolutionRate },
    charts: { topFinTopicsData }
  };
};
