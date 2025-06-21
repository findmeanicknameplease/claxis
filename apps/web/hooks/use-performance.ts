'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { PerformanceOptimizer, LoadingStateManager, CacheManager } from '@/lib/performance/optimization';

// Hook for monitoring component performance
export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>();
  const [renderTime, setRenderTime] = useState<number>(0);
  const [rerenderCount, setRerenderCount] = useState<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    setRerenderCount(prev => prev + 1);
    
    return () => {
      if (renderStartTime.current) {
        const endTime = performance.now();
        const duration = endTime - renderStartTime.current;
        setRenderTime(duration);
        
        if (duration > 16) { // More than one frame (60fps)
          console.warn(`🐌 Slow render in ${componentName}: ${duration.toFixed(2)}ms`);
        }
      }
    };
  });

  return { renderTime, rerenderCount };
}

// Hook for optimized data fetching with caching
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { ttl = 5 * 60 * 1000, enabled = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController>();

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Check cache first
    const cachedData = CacheManager.get<T>(key);
    if (cachedData) {
      setData(cachedData);
      onSuccess?.(cachedData);
      return;
    }

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    LoadingStateManager.setLoading(key, true);
    setError(null);

    try {
      const result = await fetcher();
      
      // Only update if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setData(result);
        CacheManager.set(key, result, ttl);
        onSuccess?.(result);
      }
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setIsLoading(false);
        LoadingStateManager.setLoading(key, false);
      }
    }
  }, [key, fetcher, enabled, ttl, onSuccess, onError]);

  useEffect(() => {
    fetchData();
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    CacheManager.invalidate(key);
    return fetchData();
  }, [key, fetchData]);

  const invalidateCache = useCallback(() => {
    CacheManager.invalidate(key);
  }, [key]);

  return {
    data,
    error,
    isLoading,
    refetch,
    invalidateCache,
  };
}

// Hook for optimized loading states
export function useLoadingState(key: string) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    return LoadingStateManager.subscribe(key, setIsLoading);
  }, [key]);

  const setLoading = useCallback((loading: boolean) => {
    LoadingStateManager.setLoading(key, loading);
  }, [key]);

  return { isLoading, setLoading };
}

// Hook for debounced values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for throttled callbacks
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttledCallback = useRef<T>();
  // const lastRan = useRef<number>(); // Reserved for future implementation

  useEffect(() => {
    throttledCallback.current = PerformanceOptimizer.throttle(callback, delay) as T;
  }, [callback, delay]);

  return throttledCallback.current || callback;
}

// Hook for viewport monitoring
export function useInViewport(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isInViewport, setIsInViewport] = useState<boolean>(false);
  const [intersectionRatio, setIntersectionRatio] = useState<number>(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsInViewport(entry.isIntersecting);
          setIntersectionRatio(entry.intersectionRatio);
        }
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, options]);

  return { isInViewport, intersectionRatio };
}

// Hook for optimized scroll handling
export function useOptimizedScroll(
  callback: (scrollY: number) => void,
  throttleMs: number = 16
) {
  const callbackRef = useRef(callback);
  const throttledCallback = useRef<typeof callback>();

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    throttledCallback.current = PerformanceOptimizer.throttle(
      (scrollY: number) => callbackRef.current(scrollY),
      throttleMs
    );

    const handleScroll = () => {
      throttledCallback.current?.(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [throttleMs]);
}

// Hook for image lazy loading
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || '');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const { isInViewport } = useInViewport(imgRef);

  useEffect(() => {
    if (isInViewport && src && !imageLoaded && !imageError) {
      const img = new Image();
      
      img.onload = () => {
        setImageSrc(src);
        setImageLoaded(true);
      };
      
      img.onerror = () => {
        setImageError(true);
      };
      
      img.src = src;
    }
  }, [isInViewport, src, imageLoaded, imageError]);

  return {
    ref: imgRef,
    src: imageSrc,
    loaded: imageLoaded,
    error: imageError,
  };
}

// Hook for Web Vitals monitoring
export function useWebVitals() {
  const [vitals, setVitals] = useState<Record<string, number>>({});

  useEffect(() => {
    // Initialize performance monitoring
    PerformanceOptimizer.initialize();

    const interval = setInterval(() => {
      const metrics = PerformanceOptimizer.getMetrics();
      const webVitals: Record<string, number> = {};
      
      Object.entries(metrics).forEach(([key, value]) => {
        if (['LCP', 'FID', 'CLS'].includes(key)) {
          webVitals[key] = value.avg;
        }
      });
      
      setVitals(webVitals);
    }, 5000); // Update every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  return vitals;
}