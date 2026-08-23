import { useEffect, useState } from 'react';
import {
  terminalConfigService,
  TerminalConfiguration,
} from './TerminalConfigService';

export function useTerminalConfig() {
  const [config, setConfig] = useState<TerminalConfiguration>(
    terminalConfigService.getSnapshot(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    terminalConfigService.load().then(nextConfig => {
      if (!mounted) {
        return;
      }

      setConfig(nextConfig);
      setIsLoaded(true);
    });

    const unsubscribe = terminalConfigService.subscribe(() => {
      setConfig(terminalConfigService.getSnapshot());
      setIsLoaded(true);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    config,
    isLoaded,
  };
}
