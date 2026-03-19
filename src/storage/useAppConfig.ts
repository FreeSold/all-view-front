import { useCallback, useEffect, useState } from 'react'
import { getAppData, updateAppData } from './appStore'
import type { AppConfig } from './types'

export function useAppConfig() {
  const [config, setConfigState] = useState<AppConfig>(() => getAppData().config)

  useEffect(() => {
    setConfigState(getAppData().config)
  }, [])

  const updateConfig = useCallback((updater: (c: AppConfig) => void) => {
    updateAppData((d) => {
      updater(d.config)
    })
    setConfigState({ ...getAppData().config })
  }, [])

  return [config, updateConfig] as const
}
