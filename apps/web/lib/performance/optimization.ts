// Performance optimization utilities for premium SaaS experience

export class PerformanceOptimizer {
  private static metrics: Map<string, number[]> = new Map();

  static initialize() {
    if (typeof window === 'undefined') return;

    // Web Vitals monitoring
    this.setupWebVitalsMonitoring();
    
    // Resource timing monitoring
    this.setupResourceMonitoring();
    
    // Memory usage monitoring
    this.setupMemoryMonitoring();
  }

  private static setupWebVitalsMonitoring() {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('LCP', entry.startTime);
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as any;
          this.recordMetric('FID', fidEntry.processingStart - fidEntry.startTime);
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift (CLS)
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as any;
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        }
        this.recordMetric('CLS', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }

  private static setupResourceMonitoring() {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resourceEntry = entry as PerformanceResourceTiming;
          
          // Monitor slow resources (>2s)
          if (resourceEntry.duration > 2000) {
            console.warn(`Slow resource detected: ${resourceEntry.name} took ${resourceEntry.duration}ms`);
          }
          
          // Track different resource types
          this.recordMetric(`resource_${resourceEntry.initiatorType}`, resourceEntry.duration);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    }
  }

  private static setupMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.recordMetric('memory_used', memory.usedJSHeapSize);
        this.recordMetric('memory_total', memory.totalJSHeapSize);
        
        // Warn if memory usage is high
        const usagePercent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
        if (usagePercent > 80) {
          console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`);
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private static recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
    
    this.metrics.set(name, values);
  }

  static getMetrics() {
    const results: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        results[name] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    }
    
    return results;
  }

  // Image optimization utilities
  static createImageOptimizer() {
    return {
      // Lazy loading with intersection observer
      lazyLoad: (selector: string = 'img[data-src]') => {
        if ('IntersectionObserver' in window) {
          const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                if (img.dataset['src']) {
                  img.src = img.dataset['src'];
                  img.removeAttribute('data-src');
                  imageObserver.unobserve(img);
                }
              }
            });
          });

          document.querySelectorAll(selector).forEach((img) => {
            imageObserver.observe(img);
          });
        }
      },

      // Progressive image loading
      progressiveLoad: (img: HTMLImageElement, highResSrc: string) => {
        const tempImg = new Image();
        tempImg.onload = () => {
          img.src = highResSrc;
          img.classList.remove('blur-sm');
        };
        tempImg.src = highResSrc;
      },
    };
  }

  // Code splitting utilities
  static createDynamicImporter<T>() {
    const cache = new Map<string, Promise<T>>();
    
    return (importPath: string, loader: () => Promise<T>): Promise<T> => {
      if (cache.has(importPath)) {
        return cache.get(importPath)!;
      }
      
      const promise = loader().catch((error) => {
        // Remove failed import from cache so it can be retried
        cache.delete(importPath);
        throw error;
      });
      
      cache.set(importPath, promise);
      return promise;
    };
  }

  // Debounce utility for performance
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  }

  // Throttle utility for performance
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // Bundle analyzer helper
  static analyzeBundleSize() {
    if (typeof window === 'undefined') return;
    
    const scripts = Array.from(document.scripts).filter(script => script.src);
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    console.group('🚀 Bundle Analysis');
    console.log(`📦 Scripts loaded: ${scripts.length}`);
    console.log(`🎨 Stylesheets loaded: ${styles.length}`);
    
    // Calculate estimated bundle size
    // let totalSize = 0;
    scripts.forEach((script, index) => {
      if (script.src.includes('_next/static')) {
        console.log(`📄 Script ${index + 1}: ${script.src.split('/').pop()}`);
      }
    });
    
    console.groupEnd();
  }
}

// Premium loading states component utility
export class LoadingStateManager {
  private static loadingStates = new Map<string, boolean>();
  private static subscribers = new Map<string, Set<(loading: boolean) => void>>();

  static setLoading(key: string, isLoading: boolean) {
    this.loadingStates.set(key, isLoading);
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(callback => callback(isLoading));
    }
  }

  static subscribe(key: string, callback: (loading: boolean) => void) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    
    // Call immediately with current state
    callback(this.loadingStates.get(key) || false);
    
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  static getLoadingState(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }
}

// Cache management for premium performance
export class CacheManager {
  private static cache = new Map<string, { data: any; expiry: number }>();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  static set(key: string, data: any, ttl: number = this.DEFAULT_TTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }

  static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  static invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  static size() {
    return this.cache.size;
  }
}