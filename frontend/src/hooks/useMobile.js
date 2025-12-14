import { useState, useEffect, useCallback } from 'react';

/**
 * 检测是否为移动设备
 */
export const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
};

/**
 * 移动端侧边栏控制
 */
export const useMobileSidebar = () => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const isMobile = useIsMobile();

  const openSidebar = useCallback(() => {
    setSidebarVisible(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarVisible(false);
    document.body.style.overflow = '';
  }, []);

  const toggleSidebar = useCallback(() => {
    if (sidebarVisible) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }, [sidebarVisible, openSidebar, closeSidebar]);

  // 移动端点击菜单项后自动关闭侧边栏
  const onMenuSelect = useCallback(() => {
    if (isMobile) {
      closeSidebar();
    }
  }, [isMobile, closeSidebar]);

  // 在非移动端时重置状态 - 使用useLayoutEffect和条件判断
  useEffect(() => {
    if (!isMobile && sidebarVisible) {
      // 只更新DOM，不更新state来避免级联渲染
      document.body.style.overflow = '';
      // 延迟setState以避免同步调用
      const timer = setTimeout(() => setSidebarVisible(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isMobile, sidebarVisible]);

  return {
    isMobile,
    sidebarVisible,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    onMenuSelect,
  };
};

/**
 * 检测触摸设备
 */
export const useTouchDevice = () => {
  // 初始化时直接检测，避免在useEffect中同步调用setState
  const [isTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  return isTouch;
};

/**
 * 屏幕方向检测
 */
export const useOrientation = () => {
  const [orientation, setOrientation] = useState(
    typeof window !== 'undefined' 
      ? window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      : 'portrait'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return orientation;
};

export default {
  useIsMobile,
  useMobileSidebar,
  useTouchDevice,
  useOrientation,
};
