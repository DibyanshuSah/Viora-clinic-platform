import React, { useState } from 'react';

const RevenueChart = ({ timeline = [], breakdown = {} }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
        No timeline data available for chart
      </div>
    );
  }

  const maxRevenue = Math.max(...timeline.map((t) => t.revenue || 0), 1000);
  const chartHeight = 180;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* BAR CHART: REVENUE OVER TIME */}
      <div style={{ position: 'relative', height: `${chartHeight + 40}px`, paddingTop: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: `${chartHeight}px`,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '2px',
            gap: '8px'
          }}
        >
          {timeline.map((item, idx) => {
            const heightPercent = Math.max(8, (item.revenue / maxRevenue) * 100);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* TOOLTIP ON HOVER */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-65px',
                      backgroundColor: 'var(--bg-sidebar)',
                      color: '#FFFFFF',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      zIndex: 20,
                      whiteSpace: 'nowrap',
                      boxShadow: 'var(--shadow-md)',
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <div>Gross: ₹{item.revenue.toLocaleString()}</div>
                    <div style={{ color: '#818CF8' }}>Doc Cut: ₹{item.doctorCut.toLocaleString()}</div>
                  </div>
                )}

                {/* STACKED REVENUE BARS (Doctor Cut + Clinic Share) */}
                <div
                  style={{
                    width: '70%',
                    maxWidth: '42px',
                    height: `${heightPercent}%`,
                    borderRadius: '4px 4px 0 0',
                    backgroundColor: isHovered ? 'var(--role-admin-hover)' : 'var(--role-admin-primary)',
                    transition: 'all 200ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    overflow: 'hidden'
                  }}
                >
                  {/* Doctor Cut Portion in lighter tone */}
                  <div
                    style={{
                      width: '100%',
                      height: item.revenue > 0 ? `${(item.doctorCut / item.revenue) * 100}%` : '0%',
                      backgroundColor: 'rgba(255, 255, 255, 0.35)'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* X-AXIS LABELS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            gap: '8px'
          }}
        >
          {timeline.map((item, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '0.72rem',
                color: hoveredIdx === idx ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: hoveredIdx === idx ? 700 : 500
              }}
            >
              {item.label.split(',')[0]}
            </div>
          ))}
        </div>
      </div>

      {/* CHART LEGEND */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--role-admin-primary)',
              borderRadius: '2px'
            }}
          />
          <span>Clinic Share</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#A5B4FC',
              borderRadius: '2px'
            }}
          />
          <span>Doctor Payout (Cut)</span>
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;
