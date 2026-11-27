import { ArrowLeft, Coins, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { RunState } from '../../engine/types';
import { CardFace, RelicPlate } from './CardFace';
import { DeckModal } from './DeckModal';
import { useI18n } from './i18n';
import { cn } from './primitives';
import { ScreenFrame } from './ScreenFrame';

const MIN_DECK = 6;

export function ShopScreen({
  run,
  onBuyCard,
  onBuyRelic,
  onRemoveCard,
  onLeave,
  onOpenKnowledge,
}: {
  run: RunState;
  onBuyCard: (index: number) => void;
  onBuyRelic: (index: number) => void;
  onRemoveCard: (deckIndex: number) => void;
  onLeave: () => void;
  onOpenKnowledge: (id: string) => void;
}) {
  const { t, tx } = useI18n();
  const [purging, setPurging] = useState(false);
  const shop = run.activeShop;
  if (!shop) return null;

  const canRefactor = !shop.removedThisVisit && run.credits >= shop.removePrice && run.deckCardIds.length > MIN_DECK;

  return (
    <ScreenFrame
      code="SHOP"
      title={t('shopTitle')}
      subtitle={t('shopSub')}
      icon={<Store size={17} />}
      accent="#2cf07f"
      right={
        <div className="flex h-8 items-center gap-1.5 rounded-[8px] border border-black bg-oled px-3">
          <Coins size={14} className="text-amber" />
          <span className="tnum font-mono text-[15px] font-black text-amber glow-amber">{run.credits}</span>
          <span className="font-mono text-[9px] text-dim">{t('credits')}</span>
        </div>
      }
      footer={
        <>
          <span className="text-[11.5px] text-mute">{tx('离开后本次商店库存作废。', 'Inventory is discarded once you leave.')}</span>
          <div className="flex-1" />
          <button onClick={onLeave} className="keycap keycap-te flex h-10 items-center gap-2 px-5 text-[13px] font-black tracking-wider">
            <ArrowLeft size={14} /> {t('continueMap')}
          </button>
        </>
      }
      bodyClassName="grid grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_270px] desk:overflow-visible"
    >
      <div className="flex min-h-0 flex-col gap-3">
        {/* Card shelf */}
        <div className="oled flex min-h-0 flex-1 items-center justify-center gap-3 p-3">
          {shop.cards.map((item, i) => {
            const broke = run.credits < item.price;
            return (
              <div key={`${item.cardId}-${i}`} className="relative z-10">
                <CardFace
                  cardId={item.cardId}
                  onBook={onOpenKnowledge}
                  disabled={item.sold || broke}
                  onClick={item.sold || broke ? undefined : () => onBuyCard(i)}
                  footer={
                    <div
                      className={cn(
                        'flex items-center justify-center gap-1 py-1.5 font-mono text-[11px] font-black',
                        item.sold ? 'text-dim' : broke ? 'text-estop' : 'text-amber',
                      )}
                    >
                      {item.sold ? (
                        t('shopSold')
                      ) : (
                        <>
                          <Coins size={11} /> {item.price}
                        </>
                      )}
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Relic shelf */}
        <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-2">
          {shop.relics.map((item, i) => {
            const broke = run.credits < item.price;
            return (
              <RelicPlate
                key={item.relicId}
                relicId={item.relicId}
                onBook={onOpenKnowledge}
                className={cn(item.sold && 'opacity-45')}
                footer={
                  <button
                    onClick={() => onBuyRelic(i)}
                    disabled={item.sold || broke}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 py-1.5 font-mono text-[11px] font-black transition',
                      item.sold ? 'text-dim' : broke ? 'cursor-not-allowed text-estop/70' : 'bg-amber/10 text-amber hover:bg-amber/20',
                    )}
                  >
                    {item.sold ? (
                      t('shopSold')
                    ) : (
                      <>
                        <Coins size={11} /> {item.price} · {t('rewardClaimRelic')}
                      </>
                    )}
                  </button>
                }
              />
            );
          })}
        </div>
      </div>

      {/* Refactor service */}
      <aside className="flex min-h-0 flex-col gap-3 rounded-[12px] border border-[#3a1c1c] bg-gradient-to-b from-[#1a0f0f] to-[#120b0b] p-3.5">
        <div className="flex items-center gap-2">
          <Trash2 size={16} className="text-estop" />
          <span className="font-display text-[13px] font-black tracking-wider">{t('shopRefactor')}</span>
        </div>
        <p className="text-[12px] leading-relaxed text-ink-2">
          {tx(
            '删掉冗余卡与「技术债」故障卡，让关键 Combo 更稳定地上手。每次光顾限 1 次。',
            'Purge redundant cards and FAULT tech debt so key combos show up more often. Once per visit.',
          )}
        </p>
        <div className="oled grid grid-cols-2 gap-px p-0 font-mono">
          <div className="relative z-10 px-3 py-2">
            <div className="text-[8.5px] text-dim">{tx('价格', 'PRICE')}</div>
            <div className="tnum text-[16px] font-black text-amber">{shop.removePrice}</div>
          </div>
          <div className="relative z-10 px-3 py-2">
            <div className="text-[8.5px] text-dim">{t('deckCount')}</div>
            <div className="tnum text-[16px] font-black text-scope">{run.deckCardIds.length}</div>
          </div>
        </div>
        <button
          onClick={() => setPurging(true)}
          disabled={!canRefactor}
          className="keycap keycap-estop mt-auto flex h-10 items-center justify-center gap-2 text-[12px] font-black"
        >
          <Trash2 size={13} />
          {shop.removedThisVisit ? tx('本次已重构', 'ALREADY REFACTORED') : tx('选择要删除的卡', 'CHOOSE A CARD TO PURGE')}
        </button>
        {!canRefactor && !shop.removedThisVisit && (
          <div className="text-center font-mono text-[10px] text-estop">
            {run.credits < shop.removePrice ? tx('经费不足', 'Insufficient credits') : tx(`牌库至少保留 ${MIN_DECK} 张`, `Deck minimum is ${MIN_DECK}`)}
          </div>
        )}
      </aside>

      <DeckModal
        open={purging}
        mode="remove"
        deckCardIds={run.deckCardIds}
        title={`${t('shopRefactor')} · −${shop.removePrice} CR`}
        subtitle={tx('点击一张卡将其永久删除（技术债优先显示）。', 'Click a card to purge it permanently (FAULT cards listed first).')}
        onPick={(idx) => {
          onRemoveCard(idx);
          setPurging(false);
        }}
        onClose={() => setPurging(false)}
      />
    </ScreenFrame>
  );
}
