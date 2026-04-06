import React from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6'];
const TOPIC_COLORS = ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'];
const FIN_TOPIC_COLORS = ['#ec4899', '#db2777', '#be185d', '#9d174d', '#831843'];

export const Charts = ({ charts, finCharts }) => {
  return (
    <div className="charts-container">
      
      {/* 1. Daily Conversation Trend */}
      <div className="chart-card glass-panel wide">
        <h3 className="chart-title">Daily Conversation Trend</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorConvo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#cbd5e1" tick={{ fill: '#64748b'}} tickMargin={10} minTickGap={30}/>
              <YAxis stroke="#cbd5e1" tick={{ fill: '#64748b'}}/>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                itemStyle={{ color: '#8b5cf6' }}
              />
              <Area type="monotone" dataKey="Conversations" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorConvo)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Top 5 Topics */}
      <div className="chart-card glass-panel wide">
        <h3 className="chart-title">Top 5 Topics</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topTopicsData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b'}} />
              <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b', fontSize: 11 }} width={250} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <Tooltip 
                cursor={{fill: 'rgba(0,0,0,0.03)'}}
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]}>
                {charts.topTopicsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TOPIC_COLORS[index % TOPIC_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2b. Top 5 Fin AI Topics */}
      {finCharts && finCharts.topFinTopicsData.length > 0 && (
        <div className="chart-card glass-panel wide">
          <h3 className="chart-title">Top 5 Fin AI Topics</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finCharts.topFinTopicsData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b'}} />
                <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b', fontSize: 11 }} width={250} />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.03)'}}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }}
                />
                <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]}>
                  {finCharts.topFinTopicsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FIN_TOPIC_COLORS[index % FIN_TOPIC_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. CSAT Breakdown */}
      <div className="chart-card glass-panel">
        <h3 className="chart-title">CSAT Breakdown</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.csatData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {charts.csatData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pie-legend">
          {charts.csatData.map((entry, index) => (
            <div key={entry.name} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
              <span>{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Ticket Channels */}
      <div className="chart-card glass-panel">
        <h3 className="chart-title">Volume by Channel</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.channelData.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <XAxis type="number" stroke="#cbd5e1" tick={{ fill: '#64748b'}} />
              <YAxis dataKey="name" type="category" stroke="#cbd5e1" tick={{ fill: '#64748b'}} width={80} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <Tooltip 
                cursor={{fill: 'rgba(0,0,0,0.03)'}}
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {charts.channelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
