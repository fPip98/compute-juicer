import { useCallback, useEffect, useMemo, useState } from 'react';
import { audioSynth } from '../audio/synth';
import { CARD_LIST, CARD_REGISTRY } from '../data/cards';
import { ENCOUNTER_REGISTRY } from '../data/encounters';
import { EVENT_REGISTRY } from '../data/events';
import { FAULT_REGISTRY } from '../data/faults';
import { PROFILE_REGISTRY, STARTER_PROFILES } from '../data/profiles';
import { RELIC_LIST, RELIC_REGISTRY } from '../data/relics';
import {
  commitTurn,
  reorderStagedCard,
  stageCard,
  unstageCard,
} from '../engine/battle';
import { computeTelemetry } from '../engine/physics';
import { evaluatePipeline } from '../engine/pipeline';
import {
  buyShopCard,
  buyShopRelic,
  claimRestBonusCredits,
  claimRewardCard,
  claimRewardRelic,
  createInitialRunState,
  enterMapNode,
  finishBattleInRun,
  proceedToMapFromNode,
  removeDeckCardAtRest,
  removeDeckCardInShop,
  resolveEventChoice,
  RunContentPools,
  skipRewardCard,
  startRunWithProfile,
  switchRunAct,
} from '../engine/run';
import { BattleState, EncounterDef, RunState } from '../engine/types';
import { loadLocale, Locale, saveLocale } from '../i18n';

const RUN_POOLS: RunContentPools = {
  cards: CARD_LIST,
  relics: RELIC_LIST,
  relicRegistry: RELIC_REGISTRY,
  encounters: ENCOUNTER_REGISTRY,
  events: EVENT_REGISTRY,
  profiles: PROFILE_REGISTRY,
};

const RUN_SAVE_KEY = 'compute_juicer_run_save_v1';

function loadSavedRun(): RunState {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RunState;
      if (
        parsed &&
        typeof parsed.phase === 'string' &&
        Array.isArray(parsed.deckCardIds) &&
        Array.isArray(parsed.relicIds) &&
        Array.isArray(parsed.nodes)
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupt save
  }
  return createInitialRunState();
}

export function useComputeGame() {
  const [run, setRun] = useState<RunState>(() => loadSavedRun());

  // Auto-save RunState on every change so refreshing resumes right where the player left off
  useEffect(() => {
    try {
      if (run.phase === 'SELECT_PROFILE') {
        localStorage.removeItem(RUN_SAVE_KEY);
      } else {
        localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(run));
      }
    } catch {
      // ignore storage quota errors
    }
  }, [run]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [gdbOpen, setGdbOpen] = useState(false);
  const [gdbFocusKnowledgeId, setGdbFocusKnowledgeId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeExecStep, setActiveExecStep] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [locale, setLocale] = useState<Locale>(() => loadLocale());

  const battle: BattleState | null = run.activeBattle;
  const encounter: EncounterDef | null = run.activeEncounterId
    ? ENCOUNTER_REGISTRY[run.activeEncounterId] ?? null
    : null;

  const baseTelemetry = useMemo(
    () => (battle ? computeTelemetry(battle.baseMetrics) : null),
    [battle],
  );

  // Sync dynamic BGM tension when in battle and RAM > 85% or Thermal Throttled
  useEffect(() => {
    const highTension =
      !!battle &&
      !!baseTelemetry &&
      (baseTelemetry.ramPercent >= 85 ||
        baseTelemetry.isThermalThrottled ||
        battle.stability <= 1);
    audioSynth.setTension(highTension);
  }, [battle, baseTelemetry]);

  const pipelineEval = useMemo(() => {
    if (!battle) return null;
    const previewCards = [...battle.stagedPipeline];
    if (hoveredCardId) {
      const hoveredInst = battle.hand.find((c) => c.instanceId === hoveredCardId);
      if (hoveredInst) previewCards.push(hoveredInst);
    }
    return evaluatePipeline(battle, previewCards, CARD_REGISTRY);
  }, [battle, hoveredCardId]);

  const stagedEval = useMemo(
    () => (battle ? evaluatePipeline(battle, battle.stagedPipeline, CARD_REGISTRY) : null),
    [battle],
  );

  // ==================== RUN ACTIONS ====================
  const startWithProfile = useCallback((profileId: string, startAct: 1 | 2 | 3 = 1) => {
    const profile = PROFILE_REGISTRY[profileId];
    if (!profile) return;
    audioSynth.playClick();
    setHoveredCardId(null);
    setActiveExecStep(null);
    setIsExecuting(false);
    setRun(startRunWithProfile(profile, startAct));
  }, []);

  const switchAct = useCallback((targetAct: 1 | 2 | 3) => {
    audioSynth.playClick();
    setHoveredCardId(null);
    setActiveExecStep(null);
    setIsExecuting(false);
    setRun((prev) => switchRunAct(prev, targetAct));
  }, []);

  const enterNode = useCallback((nodeId: string) => {
    audioSynth.playClick();
    setHoveredCardId(null);
    setActiveExecStep(null);
    setIsExecuting(false);
    setRun((prev) => enterMapNode(prev, nodeId, RUN_POOLS));
  }, []);

  const proceedFromBattle = useCallback(() => {
    audioSynth.playClick();
    setRun((prev) => finishBattleInRun(prev, RUN_POOLS));
  }, []);

  const pickRewardCard = useCallback((cardId: string) => {
    audioSynth.playSlaPass();
    setRun((prev) => claimRewardCard(prev, cardId));
  }, []);

  const skipReward = useCallback(() => {
    audioSynth.playClick();
    setRun((prev) => skipRewardCard(prev));
  }, []);

  const pickRewardRelic = useCallback(() => {
    audioSynth.playOverdriveBurst();
    setRun((prev) => claimRewardRelic(prev));
  }, []);

  const continueToMap = useCallback(() => {
    audioSynth.playClick();
    setRun((prev) => proceedToMapFromNode(prev));
  }, []);

  const buyCard = useCallback((index: number) => {
    audioSynth.playClick();
    setRun((prev) => buyShopCard(prev, index));
  }, []);

  const buyRelic = useCallback((index: number) => {
    audioSynth.playOverdriveBurst();
    setRun((prev) => buyShopRelic(prev, index));
  }, []);

  const removeCardInShop = useCallback((deckIndex: number) => {
    audioSynth.playClick();
    setRun((prev) => removeDeckCardInShop(prev, deckIndex));
  }, []);

  const removeCardAtRest = useCallback((deckIndex: number) => {
    audioSynth.playSlaPass();
    setRun((prev) => removeDeckCardAtRest(prev, deckIndex));
  }, []);

  const takeRestCredits = useCallback(() => {
    audioSynth.playClick();
    setRun((prev) => claimRestBonusCredits(prev));
  }, []);

  const pickEventChoice = useCallback((choiceId: string) => {
    audioSynth.playClick();
    setRun((prev) => resolveEventChoice(prev, choiceId, RUN_POOLS));
  }, []);

  const restartRun = useCallback(() => {
    audioSynth.playClick();
    setHoveredCardId(null);
    setActiveExecStep(null);
    setIsExecuting(false);
    setRun(createInitialRunState());
  }, []);

  // ==================== BATTLE ACTIONS ====================
  const handleStageCard = useCallback((instanceId: string) => {
    audioSynth.playClick();
    setHoveredCardId(null);
    setRun((prev) =>
      prev.activeBattle
        ? { ...prev, activeBattle: stageCard(prev.activeBattle, instanceId) }
        : prev,
    );
  }, []);

  const handleUnstageCard = useCallback((instanceId: string) => {
    audioSynth.playClick();
    setRun((prev) =>
      prev.activeBattle
        ? { ...prev, activeBattle: unstageCard(prev.activeBattle, instanceId) }
        : prev,
    );
  }, []);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    audioSynth.playClick();
    setRun((prev) =>
      prev.activeBattle
        ? {
            ...prev,
            activeBattle: reorderStagedCard(prev.activeBattle, fromIndex, toIndex),
          }
        : prev,
    );
  }, []);

  const handleCommit = useCallback(async () => {
    if (
      isExecuting ||
      !battle ||
      !encounter ||
      !stagedEval ||
      battle.status !== 'PLANNING' ||
      !stagedEval.preview.valid
    ) {
      return;
    }
    setIsExecuting(true);
    setHoveredCardId(null);

    const steps = stagedEval.preview.steps;
    for (let i = 0; i < steps.length; i++) {
      setActiveExecStep(i);
      audioSynth.playPipelineTick(i);
      if (steps[i].bottleneckChanged) {
        audioSynth.playRooflineShift();
      }
      const delayMs = Math.max(130, 290 - i * 40);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    if (stagedEval.preview.overdriveActive) {
      audioSynth.playOverdriveBurst();
      await new Promise((r) => setTimeout(r, 180));
    }

    const nextBattle = commitTurn(
      battle,
      encounter,
      CARD_REGISTRY,
      FAULT_REGISTRY,
      RELIC_REGISTRY,
    );

    if (nextBattle.status === 'DEFEAT') {
      audioSynth.playOomPanic();
    } else if (nextBattle.slaPasses > battle.slaPasses) {
      audioSynth.playSlaPass();
    }

    setRun((prev) => ({ ...prev, activeBattle: nextBattle }));
    setActiveExecStep(null);
    setIsExecuting(false);
  }, [battle, encounter, isExecuting, stagedEval]);

  // ==================== GLOBAL CONTROLS ====================
  const openGdb = useCallback((knowledgeId?: string) => {
    if (knowledgeId) setGdbFocusKnowledgeId(knowledgeId);
    setGdbOpen(true);
    audioSynth.setGdbHaltMode(true);
  }, []);

  const closeGdb = useCallback(() => {
    setGdbOpen(false);
    audioSynth.setGdbHaltMode(false);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audioSynth.setMuted(next);
      return next;
    });
  }, []);

  const toggleBgm = useCallback(() => {
    setBgmEnabled((prev) => {
      const next = !prev;
      audioSynth.setBgmEnabled(next);
      return next;
    });
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next: Locale = prev === 'zh' ? 'en' : 'zh';
      saveLocale(next);
      return next;
    });
  }, []);

  return {
    run,
    profiles: STARTER_PROFILES,
    encounter,
    battle,
    baseTelemetry,
    pipelinePreview: pipelineEval?.preview ?? null,
    stagedPreview: stagedEval?.preview ?? null,
    hoveredCardId,
    setHoveredCardId,
    isExecuting,
    activeExecStep,
    gdbOpen,
    gdbFocusKnowledgeId,
    setGdbFocusKnowledgeId,
    muted,
    bgmEnabled,
    locale,
    // Run actions
    startWithProfile,
    switchAct,
    enterNode,
    proceedFromBattle,
    pickRewardCard,
    skipReward,
    pickRewardRelic,
    continueToMap,
    buyCard,
    buyRelic,
    removeCardInShop,
    removeCardAtRest,
    takeRestCredits,
    pickEventChoice,
    restartRun,
    // Battle actions
    handleStageCard,
    handleUnstageCard,
    handleReorder,
    handleCommit,
    // Global actions
    openGdb,
    closeGdb,
    toggleMute,
    toggleBgm,
    toggleLocale,
  };
}
