import { createContext, useContext, useMemo } from 'react';
import { CardDef, EncounterDef, FaultDef, RelicDef } from '../../engine/types';
import {
  EN_CARD_META,
  EN_ENCOUNTER_META,
  EN_FAULT_META,
  EN_RELIC_META,
  Locale,
  UI_TEXT,
  UiTextKey,
} from '../../i18n';

/**
 * UI-layer locale access. Hard-core terms (Roofline, OOM, SLA, DVFS, PREEMPT_RT …) stay English in
 * both locales; only prose switches. Content falls back to the Chinese source when no EN entry exists.
 */
const LocaleContext = createContext<Locale>('zh');

export const LocaleProvider = LocaleContext.Provider;

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(() => {
    const en = locale === 'en';
    return {
      locale,
      en,
      t: (key: UiTextKey): string => UI_TEXT[locale][key],
      tx: (zh: string, enText: string): string => (en ? enText : zh),
      card: (def: Pick<CardDef, 'id' | 'name' | 'summary' | 'orderHint'>) => {
        const m = en ? EN_CARD_META[def.id] : undefined;
        return {
          name: m?.name ?? def.name,
          summary: m?.summary ?? def.summary,
          orderHint: m ? m.orderHint : def.orderHint,
        };
      },
      relic: (def: Pick<RelicDef, 'id' | 'name' | 'summary'>) => {
        const m = en ? EN_RELIC_META[def.id] : undefined;
        return { name: m?.name ?? def.name, summary: m?.summary ?? def.summary };
      },
      fault: (def: Pick<FaultDef, 'id' | 'name' | 'intentText'>) => {
        const m = en ? EN_FAULT_META[def.id] : undefined;
        return { name: m?.name ?? def.name, intentText: m?.intentText ?? def.intentText };
      },
      encounter: (def: Pick<EncounterDef, 'id' | 'name' | 'scenario'>) => {
        const m = en ? EN_ENCOUNTER_META[def.id] : undefined;
        return { name: m?.name ?? def.name, scenario: m?.scenario ?? def.scenario };
      },
    };
  }, [locale]);
}
