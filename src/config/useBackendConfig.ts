import { useEffect, useState } from 'react';
import { BackendConfiguration } from './backend';
import { backendConfigService } from './BackendConfigService';

export function useBackendConfig() {
  const [config, setConfig] = useState<BackendConfiguration | null>(
    backendConfigService.getSnapshot(),
  );
  const [isLoaded, setIsLoaded] = useState<boolean>(backendConfigService.getSnapshot() !== null);

  useEffect(() => {
    let mounted = true;

    backendConfigService.load().then(nextConfig => {
      if (!mounted) {
        return;
      }
      setConfig(nextConfig);
      setIsLoaded(true);
    });

    const unsubscribe = backendConfigService.subscribe(() => {
      setConfig(backendConfigService.getSnapshot());
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

