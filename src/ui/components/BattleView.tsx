import { BattleState, ComputedTelemetry, EncounterDef, OpsActionId, PipelinePreviewResult, RobotMood } from '../../engine/types';
import { HandTray } from './HandTray';
import { LatencyTimeline } from './LatencyTimeline';
import { PipelineBay } from './PipelineBay';
import { cn } from './primitives';
import { RooflineChart } from './RooflineChart';
import { SlaDashboard } from './SlaDashboard';

export interface BattleViewProps {
  battle: BattleState;
  encounter: EncounterDef;
  baseTelemetry: ComputedTelemetry;
  pipelinePreview: PipelinePreviewResult;
  stagedPreview: PipelinePreviewResult;
  hoveredCardId: string | null;
  isExecuting: boolean;
  activeExecStep: number | null;
  halted: boolean;
  reportPending: 'VICTORY' | 'DEFEAT' | null;
  flashKey: number;
  onHover: (id: string | null) => void;
  onStage: (instanceId: string) => void;
  onUnstage: (instanceId: string) => void;
  onReorder: (from: number, to: number) => void;
  onOpsAction: (actionId: OpsActionId) => void;
  onCommit: () => void;
  onShowReport: () => void;
  onOpenKnowledge: (id: string) => void;
}

/** The in-battle workbench: SLA monitor · Roofline · embodied theater · pass pipeline · hand. */
export function BattleView({
  battle,
  encounter,
  baseTelemetry,
  pipelinePreview,
  stagedPreview,
  hoveredCardId,
  isExecuting,
  activeExecStep,
  halted,
  reportPending,
  flashKey,
  onHover,
  onStage,
  onUnstage,
  onReorder,
  onOpsAction,
  onCommit,
  onShowReport,
  onOpenKnowledge,
}: BattleViewProps) {
  const planning = battle.status === 'PLANNING';
  const locked = !planning || isExecuting;
  const hoveringHand = !!hoveredCardId && battle.hand.some((c) => c.instanceId === hoveredCardId);
  const showSim = !isExecuting && (battle.stagedPipeline.length > 0 || hoveringHand);
  void encounter;

  const mood: RobotMood = isExecuting ? 'WORKING' : battle.status === 'VICTORY' ? 'VICTORY' : battle.robotMood;
  const predictedMood: RobotMood | null = showSim ? pipelinePreview.slaEval.robotMood : null;

  return (
    <main
      className={cn(
        'battlefield grid min-h-0 flex-1 grid-cols-1 gap-2',
        'lg:grid-cols-[288px_minmax(0,1fr)] desk:grid-rows-[minmax(0,1fr)_auto]',
        halted && 'battlefield-halted',
      )}
      aria-hidden={halted}
    >
      <div className="min-h-0 lg:row-start-1 [&>section]:h-full">
        <SlaDashboard
          now={{ t: baseTelemetry, m: battle.baseMetrics }}
          sim={{ t: pipelinePreview.finalTelemetry, m: pipelinePreview.finalMetrics }}
          showSim={showSim}
          simSource={hoveringHand ? 'HOVER' : battle.stagedPipeline.length > 0 ? 'PIPELINE' : null}
          sla={showSim ? pipelinePreview.effectiveSlaTarget : battle.effectiveSlaTarget}
          baseSla={battle.effectiveSlaTarget}
          upcomingFaultIds={battle.upcomingFaultIds}
          wave={battle.wave}
          onOpenKnowledge={onOpenKnowledge}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:row-start-1">
        <div className="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] desk:min-h-[168px] desk:flex-1">
          <RooflineChart
            nowM={battle.baseMetrics}
            nowT={baseTelemetry}
            simM={pipelinePreview.finalMetrics}
            simT={pipelinePreview.finalTelemetry}
            steps={pipelinePreview.steps}
            showSim={showSim || isExecuting}
            activeStep={activeExecStep}
            flashKey={flashKey}
          />
          <LatencyTimeline
            nowM={battle.baseMetrics}
            nowT={baseTelemetry}
            simM={pipelinePreview.finalMetrics}
            simT={pipelinePreview.finalTelemetry}
            sla={showSim ? pipelinePreview.effectiveSlaTarget : battle.effectiveSlaTarget}
            showSim={showSim}
            mood={mood}
            predictedMood={predictedMood}
            onOpenKnowledge={onOpenKnowledge}
          />
        </div>
        <div className="min-h-0 desk:min-h-[222px] desk:flex-1 [&>section]:h-full">
          <PipelineBay
            battle={battle}
            baseTelemetry={baseTelemetry}
            stagedPreview={stagedPreview}
            hoverPreview={pipelinePreview}
            hoveringHand={hoveringHand && !isExecuting}
            isExecuting={isExecuting}
            activeExecStep={activeExecStep}
            reportPending={reportPending}
            onShowReport={onShowReport}
            onUnstage={onUnstage}
            onReorder={onReorder}
            onOpsAction={onOpsAction}
            onCommit={onCommit}
            onOpenKnowledge={onOpenKnowledge}
          />
        </div>
      </div>

      <div className="min-h-0 lg:col-span-2 lg:row-start-2">
        <HandTray
          hand={battle.hand}
          cyclesRemaining={stagedPreview.cyclesRemaining}
          locked={locked}
          ended={!planning}
          hoveredId={hoveredCardId}
          drawCount={battle.drawPile.length}
          discardCount={battle.discardPile.length}
          exhaustCount={battle.exhaustPile.length}
          onHover={(id) => onHover(locked ? null : id)}
          onStage={onStage}
          onOpenKnowledge={onOpenKnowledge}
        />
      </div>
    </main>
  );
}
