import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { JuiceGrade } from './engine/types';
import { UI_TEXT } from './i18n';
import { BattleView } from './ui/components/BattleView';
import { DeckModal } from './ui/components/DeckModal';
import { EventScreen } from './ui/components/EventScreen';
import { GdbDrawer } from './ui/components/GdbDrawer';
import { LocaleProvider } from './ui/components/i18n';
import { ProfileSelect } from './ui/components/ProfileSelect';
import { RestScreen } from './ui/components/RestScreen';
import { ResultOverlay } from './ui/components/ResultOverlay';
import { RewardScreen } from './ui/components/RewardScreen';
import { RunEndScreen } from './ui/components/RunEndScreen';
import { RunMap } from './ui/components/RunMap';
import { ShopScreen } from './ui/components/ShopScreen';
import { TopBar } from './ui/components/TopBar';
import { useComputeGame } from './ui/useComputeGame';

const GRADE_RANK: Record<JuiceGrade, number> = { S: 4, A: 3, B: 2, C: 1 };

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    el.isContentEditable ||
    el.getAttribute('role') === 'button'
  );
}

export default function App() {
  const game = useComputeGame();
  const {
    run,
    profiles,
    encounter,
    battle,
    baseTelemetry,
    pipelinePreview,
    stagedPreview,
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
    handleStageCard,
    handleUnstageCard,
    handleReorder,
    handleOpsAction,
    handleCommit,
    openGdb,
    closeGdb,
    toggleMute,
    toggleBgm,
    toggleLocale,
  } = game;

  const T = UI_TEXT[locale];
  const tx = (zh: string, en: string) => (locale === 'en' ? en : zh);
  const [deckOpen, setDeckOpen] = useState(false);

  const inBattle = run.phase === 'BATTLE' && !!battle && !!encounter && !!baseTelemetry && !!pipelinePreview && !!stagedPreview;
  const planning = battle?.status === 'PLANNING';

  /* ---------------- Battle result overlay ---------------- */
  const resultKey = battle ? `${run.currentNodeId}:${battle.encounterId}:${battle.wave}:${battle.status}` : 'none';
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const showResult = inBattle && !planning && dismissedKey !== resultKey;
  const reportPending: 'VICTORY' | 'DEFEAT' | null =
    inBattle && battle && !planning && !showResult ? (battle.status as 'VICTORY' | 'DEFEAT') : null;
  const reopenReport = () => setDismissedKey(null);
  const currentNode = run.nodes.find((n) => n.id === run.currentNodeId);
  const isFinalBoss = currentNode?.type === 'BOSS' && run.act === 3;

  /* ---------------- Juice grade bookkeeping (grade of each wave that actually passed SLA) ---------------- */
  const pendingGradeRef = useRef<JuiceGrade | null>(null);
  const prevPassesRef = useRef(0);
  const [passGrades, setPassGrades] = useState<JuiceGrade[]>([]);
  useEffect(() => {
    if (isExecuting && stagedPreview) pendingGradeRef.current = stagedPreview.juiceGrade;
  }, [isExecuting, stagedPreview]);
  const slaPasses = battle?.slaPasses ?? 0;
  const wave = battle?.wave ?? 0;
  useEffect(() => {
    if (wave <= 1 && slaPasses === 0) {
      setPassGrades([]);
    } else if (slaPasses > prevPassesRef.current && pendingGradeRef.current) {
      const g = pendingGradeRef.current;
      setPassGrades((prev) => [...prev, g]);
    }
    prevPassesRef.current = slaPasses;
  }, [slaPasses, wave, run.currentNodeId]);
  const bestGrade = passGrades.reduce<JuiceGrade | null>((best, g) => (!best || GRADE_RANK[g] > GRADE_RANK[best] ? g : best), null);

  /* ---------------- Roofline breach flash during execution ---------------- */
  const execStep = activeExecStep !== null && stagedPreview ? stagedPreview.steps[activeExecStep] : undefined;
  const flashKey =
    isExecuting && execStep?.bottleneckChanged && execStep.telemetryAfter.bottleneck === 'COMPUTE_BOUND' ? (activeExecStep ?? 0) + 1 : 0;

  /* ---------------- Keyboard: F5 halt (any phase), Esc resume, Enter commit / reopen report ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault(); // never reload the bench
        if (gdbOpen) closeGdb();
        else openGdb();
        return;
      }
      if (e.key === 'Escape' && gdbOpen) {
        e.preventDefault();
        closeGdb();
        return;
      }
      if (e.key === 'Enter' && run.phase === 'BATTLE' && !gdbOpen && !deckOpen && !isTypingTarget(e.target)) {
        e.preventDefault();
        if (reportPending) setDismissedKey(null);
        else void handleCommit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gdbOpen, openGdb, closeGdb, handleCommit, reportPending, run.phase, deckOpen]);

  // Close stray UI when the run changes phase
  useEffect(() => {
    setDeckOpen(false);
    setHoveredCardId(null);
  }, [run.phase, setHoveredCardId]);

  const relicIds = battle && run.phase === 'BATTLE' ? battle.relicIds : run.relicIds;

  let screen: ReactNode = null;
  switch (run.phase) {
    case 'SELECT_PROFILE':
      screen = <ProfileSelect profiles={profiles} onStart={startWithProfile} onOpenKnowledge={openGdb} />;
      break;
    case 'MAP':
      screen = <RunMap run={run} onEnter={enterNode} onSwitchAct={switchAct} />;
      break;
    case 'BATTLE':
      screen =
        inBattle && battle && encounter && baseTelemetry && pipelinePreview && stagedPreview ? (
          <BattleView
            battle={battle}
            encounter={encounter}
            baseTelemetry={baseTelemetry}
            pipelinePreview={pipelinePreview}
            stagedPreview={stagedPreview}
            hoveredCardId={hoveredCardId}
            isExecuting={isExecuting}
            activeExecStep={activeExecStep}
            halted={gdbOpen}
            reportPending={reportPending}
            flashKey={flashKey}
            onHover={setHoveredCardId}
            onStage={handleStageCard}
            onUnstage={handleUnstageCard}
            onReorder={handleReorder}
            onOpsAction={handleOpsAction}
            onCommit={() => void handleCommit()}
            onShowReport={reopenReport}
            onOpenKnowledge={openGdb}
          />
        ) : null;
      break;
    case 'REWARD':
      screen = (
        <RewardScreen
          run={run}
          onPickCard={pickRewardCard}
          onSkip={skipReward}
          onClaimRelic={pickRewardRelic}
          onContinue={continueToMap}
          onOpenKnowledge={openGdb}
        />
      );
      break;
    case 'SHOP':
      screen = (
        <ShopScreen run={run} onBuyCard={buyCard} onBuyRelic={buyRelic} onRemoveCard={removeCardInShop} onLeave={continueToMap} onOpenKnowledge={openGdb} />
      );
      break;
    case 'REST':
      screen = <RestScreen run={run} onRemoveCard={removeCardAtRest} onTakeCredits={takeRestCredits} onLeave={continueToMap} />;
      break;
    case 'EVENT':
      screen = <EventScreen run={run} onChoose={pickEventChoice} onLeave={continueToMap} />;
      break;
    case 'RUN_VICTORY':
    case 'RUN_DEFEAT':
      screen = <RunEndScreen run={run} onNewRun={restartRun} />;
      break;
  }

  return (
    <LocaleProvider value={locale}>
      <div className="chassis-bg relative min-h-dvh desk:h-dvh desk:overflow-hidden" lang={locale === 'en' ? 'en' : 'zh-CN'}>
        {/* Game viewport: capped at 1440px so ultra-wide screens keep the same proportions */}
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 p-2 desk:h-full">
          <TopBar
            phase={run.phase}
            act={run.act}
            credits={run.credits}
            deckCount={run.deckCardIds.length}
            relicIds={relicIds}
            battle={run.phase === 'BATTLE' ? battle : null}
            encounter={run.phase === 'BATTLE' ? encounter : null}
            muted={muted}
            bgmEnabled={bgmEnabled}
            gdbOpen={gdbOpen}
            reportPending={reportPending}
            onOpenDeck={() => setDeckOpen(true)}
            onRestartRun={restartRun}
            onSwitchAct={switchAct}
            onToggleMute={toggleMute}
            onToggleBgm={toggleBgm}
            onToggleLocale={toggleLocale}
            onShowReport={reopenReport}
            onToggleGdb={() => (gdbOpen ? closeGdb() : openGdb())}
            onOpenKnowledge={openGdb}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={run.phase === 'BATTLE' ? `battle-${run.currentNodeId}` : `${run.phase}-${run.act}-${run.currentNodeId}`}
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {screen}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* SIGTRAP halt banner + click-catcher over the frozen screen */}
        <AnimatePresence>
          {gdbOpen && (
            <motion.div
              key="halt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 cursor-pointer bg-black/40"
              onClick={closeGdb}
              title={tx('点击继续运行', 'Click to resume')}
            >
              <motion.div
                initial={{ y: -40 }}
                animate={{ y: 0 }}
                exit={{ y: -40 }}
                className="absolute top-0 left-0 flex items-center gap-3 border-r border-b border-estop/50 bg-[#1a0404]/95 py-2 pr-5 pl-4 font-mono text-[11px] shadow-[0_0_40px_-8px_rgba(255,42,42,0.6)]"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-estop shadow-[0_0_10px_#ff2a2a] blink" />
                <span className="font-black tracking-wider text-estop glow-estop">SIGTRAP: CPU HALTED</span>
                <span className="hidden text-ink-2 sm:inline">{T.gdbHaltedBanner}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <GdbDrawer
          open={gdbOpen}
          focusId={gdbFocusKnowledgeId}
          battle={run.phase === 'BATTLE' ? battle : null}
          telemetry={run.phase === 'BATTLE' ? baseTelemetry : null}
          onFocus={setGdbFocusKnowledgeId}
          onClose={closeGdb}
        />

        <DeckModal open={deckOpen} deckCardIds={run.deckCardIds} onClose={() => setDeckOpen(false)} onBook={(id) => openGdb(id)} />

        <AnimatePresence>
          {showResult && battle && encounter && baseTelemetry && (
            <ResultOverlay
              key={resultKey}
              battle={battle}
              encounter={encounter}
              telemetry={baseTelemetry}
              grade={battle.status === 'VICTORY' ? bestGrade : null}
              isFinalBoss={isFinalBoss}
              onProceed={proceedFromBattle}
              onNewRun={restartRun}
              onInspect={() => setDismissedKey(resultKey)}
            />
          )}
        </AnimatePresence>
      </div>
    </LocaleProvider>
  );
}
