// Client-side logger that sends logs to the server
const LOG_ENDPOINT = `http://${window.location.hostname}:3001/api/log`;

interface LogData {
  level: string;
  message: string;
  data?: unknown;
  timestamp: string;
  userAgent: string;
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

// Send log to server using sendBeacon for reliability
const sendLog = (logData: LogData) => {
  try {
    // Always use fetch for now to get better error handling
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
      mode: 'cors',
    }).then(response => {
      if (!response.ok) {
        originalConsole.error('Failed to send log:', response.status, response.statusText);
      }
    }).catch((error) => {
      originalConsole.error('Failed to send log:', error);
    });
  } catch (error) {
    originalConsole.error('Failed to prepare log:', error);
  }
};

// Helper to format arguments for logging
const formatArgs = (args: unknown[]): { message: string; data?: unknown } => {
  if (args.length === 0) {
    return { message: '' };
  }
  
  // If first arg is a string, use it as message
  if (typeof args[0] === 'string') {
    return {
      message: args[0],
      data: args.length > 1 ? args.slice(1) : undefined,
    };
  }
  
  // Otherwise, stringify everything
  return {
    message: args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch {
        return String(arg);
      }
    }).join(' '),
  };
};

// Override console methods
export const initializeClientLogger = () => {
  // Check if we're in a desktop browser (not mobile)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (!isMobile) {
    // Desktop browser - don't override console
    originalConsole.log('Desktop browser detected - client logger console override disabled');
    return;
  }
  
  // Check if console has already been overridden (by checking if it's different from our stored original)
  if (console.log !== originalConsole.log) {
    originalConsole.log('Console already overridden (likely in HTML) - skipping client logger override');
    return;
  }
  
  // First, log to original console that we're starting
  originalConsole.log('Initializing client logger for mobile device, endpoint:', LOG_ENDPOINT);
  
  // Log that we're initializing
  sendLog({
    level: 'info',
    message: 'Client logger initialized (mobile device)',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  });

  // Override console.log
  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    const { message, data } = formatArgs(args);
    sendLog({
      level: 'log',
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  };

  // Override console.error
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    const { message, data } = formatArgs(args);
    sendLog({
      level: 'error',
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  };

  // Override console.warn
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    const { message, data } = formatArgs(args);
    sendLog({
      level: 'warn',
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  };

  // Override console.info
  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    const { message, data } = formatArgs(args);
    sendLog({
      level: 'info',
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  };

  // Override console.debug
  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    const { message, data } = formatArgs(args);
    sendLog({
      level: 'debug',
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  };

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    sendLog({
      level: 'error',
      message: `Unhandled error: ${event.message}`,
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? {
          message: event.error.message,
          stack: event.error.stack,
        } : null,
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    sendLog({
      level: 'error',
      message: `Unhandled promise rejection`,
      data: {
        reason: event.reason,
        promise: String(event.promise),
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  });
};

// Restore original console methods (useful for debugging)
export const restoreConsole = () => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
};