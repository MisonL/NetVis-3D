import React from 'react';

const HeaderTitle = () => {
    const titleStyle = {
        margin: 0,
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Outfit", sans-serif',
        fontWeight: 900,
        fontSize: '32px',
        letterSpacing: '4px',
        lineHeight: '1.2', 
        textTransform: 'uppercase',
        background: 'linear-gradient(135deg, #00C6FB 0%, #005BEA 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        filter: 'drop-shadow(0 0 10px rgba(0, 198, 251, 0.4))',
        padding: '5px 0', // Minimal padding just for vertical glow
        whiteSpace: 'nowrap',
        pointerEvents: 'none'
    };

    const subtitleStyle = {
        fontSize: '12px',
        // color: '#e6f7ff',  <-- Removed to let CSS handle theme colors
        // marginTop: '2px',  <-- Removed to let CSS handle spacing
        fontWeight: 500,
        letterSpacing: '2px',
        whiteSpace: 'nowrap',
        fontFamily: '"Outfit", sans-serif',
        opacity: 0.8,
        pointerEvents: 'none',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
    };

    const containerStyle = {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'auto',
        overflow: 'visible', // Ensure no clipping
    };

    const flexWrapperStyle = {
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '0px'
    };

  return (
    <div style={containerStyle} className="netvis-header-branding">
      <div style={flexWrapperStyle}>
        <div className="netvis-main-title" style={titleStyle}>
          数据中心实时监控平台
        </div>
        <div className="netvis-sub-title" style={subtitleStyle}>
          Data Center Real-time Monitoring Platform
        </div>
      </div>
    </div>
  );
};

export default HeaderTitle;
