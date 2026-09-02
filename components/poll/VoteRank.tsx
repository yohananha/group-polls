"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { castBallot } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Option {
  id: string;
  label: string;
  approved: boolean;
}

function RankRow({
  option,
  index,
  topN,
  onMove,
  t,
}: {
  option: Option;
  index: number;
  topN: number | null;
  onMove: (index: number, dir: -1 | 1) => void;
  t: Dictionary;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  });

  const withinTopN = topN === null || index < topN;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        isDragging ? "opacity-50" : ""
      } ${
        withinTopN
          ? "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
          : "border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950"
      }`}
    >
      <span className="w-5 shrink-0 text-center text-xs font-semibold text-neutral-400">
        {withinTopN ? index + 1 : "–"}
      </span>
      <span className="flex-1">{option.label}</span>
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label={t.vote.moveUp}
          onClick={() => onMove(index, -1)}
          className="px-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={t.vote.moveDown}
          onClick={() => onMove(index, 1)}
          className="px-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          ▼
        </button>
      </div>
      <button
        type="button"
        aria-label={t.vote.dragToReorder}
        className="shrink-0 cursor-grab touch-none px-1 text-neutral-300 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
    </li>
  );
}

export function VoteRank({
  pollId,
  options,
  myOrder,
  topN,
  allowChange,
  disabled,
  onVoted,
}: {
  pollId: string;
  options: Option[];
  myOrder: string[] | null; // option ids in the voter's previously-saved order, if any
  topN: number | null;
  allowChange: boolean;
  disabled: boolean;
  onVoted: () => void;
}) {
  const { t } = useI18n();
  const approved = options.filter((o) => o.approved);
  const initial =
    myOrder && myOrder.length > 0
      ? [...myOrder, ...approved.map((o) => o.id).filter((id) => !myOrder.includes(id))]
      : approved.map((o) => o.id);

  const [order, setOrder] = useState<string[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const approvedIds = approved.map((o) => o.id);
  const approvedIdsKey = approvedIds.join(",");

  // Options can appear (or, if unapproved later, disappear) after mount via
  // the parent's realtime option list — reconcile `order`, which otherwise
  // only ever reflects options.length at the moment this component mounted.
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((id) => approvedIds.includes(id));
      const added = approvedIds.filter((id) => !kept.includes(id));
      if (added.length === 0 && kept.length === prev.length) return prev;
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedIdsKey]);

  const hasVoted = !!myOrder && myOrder.length > 0;
  const locked = disabled || (hasVoted && !allowChange);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function move(index: number, dir: -1 | 1) {
    if (locked) return;
    const next = index + dir;
    if (next < 0 || next >= order.length) return;
    setOrder((prev) => arrayMove(prev, index, next));
  }

  function handleDragEnd(event: DragEndEvent) {
    if (locked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function submit() {
    const submitted = topN ? order.slice(0, topN) : order;
    startTransition(async () => {
      const res = await castBallot({
        poll_id: pollId,
        option_ids: submitted,
        ranks: submitted.map((_, i) => i + 1),
      });
      if (res.error) setError(res.error);
      else onVoted();
    });
  }

  const byId = new Map(approved.map((o) => [o.id, o]));

  return (
    <div className="space-y-2">
      {topN && <p className="text-xs text-neutral-400">{t.vote.onlyTopCount(topN)}</p>}
      <DndContext
        id={`rank-${pollId}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1.5">
            {order.map((id, i) => {
              const opt = byId.get(id);
              if (!opt) return null;
              return <RankRow key={id} option={opt} index={i} topN={topN} onMove={move} t={t} />;
            })}
          </ol>
        </SortableContext>
      </DndContext>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!locked && (
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t.vote.saving : hasVoted ? t.vote.updateRanking : t.vote.submitRanking}
        </button>
      )}
      {hasVoted && !allowChange && (
        <p className="text-xs text-neutral-400">{t.pollDetail.votedNoChange}</p>
      )}
    </div>
  );
}
