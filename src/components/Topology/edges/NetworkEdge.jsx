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
  
  // Dynamic styling based on status or traffic
  const edgeStyle = {
    ...style,
    strokeWidth: 2,
    stroke: isTrafficActive ? '#52c41a' : '#b1b1b7',
    strokeDasharray: isTrafficActive ? '5 5' : 'none',
    animation: isTrafficActive ? 'dashdraw 0.5s linear infinite' : 'none',
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
              background: '#fff',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              border: '1px solid #ddd',
              pointerEvents: 'all',
              zIndex: 10,
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
