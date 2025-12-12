import React, { memo } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from 'reactflow';
const NetworkEdge = ({ 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  sourcePosition, 
  targetPosition, 
  style = {}, 
  markerEnd,
  data 
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isTrafficActive = data?.traffic > 0;
  // Use stroke color from theme/variables if possible, but ReactFlow edges style needs explicit colors often
  // We'll use CSS vars where possible or fallback to theme logic
  const activeColor = '#52c41a'; // Success green
  const defaultColor = 'var(--text-tertiary)'; // Grey
  
  const edgeStyle = {
    ...style,
    strokeWidth: isTrafficActive ? 2 : 1,
    stroke: isTrafficActive ? activeColor : defaultColor,
    strokeDasharray: isTrafficActive ? '5 5' : 'none',
    animation: isTrafficActive ? 'dashdraw 0.5s linear infinite' : 'none',
    opacity: 0.8
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--glass-panel-bg)',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 10,
              border: '1px solid var(--glass-panel-border)',
              pointerEvents: 'all',
              zIndex: 10,
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
      <style>
        {`
          @keyframes dashdraw {
            from { stroke-dashoffset: 10; }
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>
    </>
  );
};

export default memo(NetworkEdge);
