"use client";

import { useId, useMemo, useState } from "react";
import { useActionState } from "react";
import { createPoll, type ActionResult } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PollType } from "@/lib/supabase/types";

const MIN_OPTIONS: Record<PollType, number> = {
  single: 2,
  multi: 2,
  rank: 2,
  bracket: 4,
};

const TYPE_COLORS: Record<PollType, { bg: string; fg: string }> = {
  single: { bg: "var(--color-type-single-bg)", fg: "var(--color-type-single-fg)" },
  multi: { bg: "var(--color-type-multi-bg)", fg: "var(--color-type-multi-fg)" },
  rank: { bg: "var(--color-type-rank-bg)", fg: "var(--color-type-rank-fg)" },
  bracket: { bg: "var(--color-type-bracket-bg)", fg: "var(--color-type-bracket-fg)" },
};

function TypeIcon({ type }: { type: PollType }) {
  if (type === "single") return <div className="h-3 w-3 rounded-full bg-white" />;
  if (type === "multi") return <div className="h-3.5 w-3.5 rounded-[4px] bg-white" />;
  if (type === "bracket") return <div className="h-3.5 w-3.5 rotate-45 bg-white" />;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="h-[3px] w-5 rounded-full bg-white" />
      <div className="h-[3px] w-3.5 rounded-full bg-white" />
      <div className="h-[3px] w-2 rounded-full bg-white" />
    </div>
  );
}

function typeInfo(t: Dictionary): Record<PollType, { label: string; blurb: string }> {
  return t.pollComposer.types;
}

const COLOR_PRESETS = ["#E8623D", "#FF8B6B", "#C9B8E8", "#FFD976", "#9FE0C4", "#7FB3E8"];

function ColorPicker({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  const isCustom = !COLOR_PRESETS.includes(value);
  return (
    <div>
      <label className="text-xs font-bold text-muted">{label}</label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
              value === c ? "border-ink" : "border-transparent"
            }`}
          >
            {value === c && <span className="text-xs font-bold text-white">✓</span>}
          </button>
        ))}
        <label
          className={`relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 bg-card text-xs ${
            isCustom ? "border-ink" : "border-border"
          }`}
          style={isCustom ? { background: value } : undefined}
        >
          <span className={isCustom ? "text-white" : "text-muted"}>{isCustom ? "✓" : "+"}</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

function Toggle({
  name,
  defaultChecked,
  checked,
  onChange,
}: {
  name: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label dir="ltr" className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={onChange ? undefined : defaultChecked}
        checked={onChange ? checked : undefined}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-border transition peer-checked:bg-accent" />
      <span className="relative left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

function VisibilityOption({
  value,
  label,
  defaultChecked,
}: {
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex-1 cursor-pointer text-center">
      <input type="radio" name="results_visibility" value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="block rounded-xl bg-border px-1 py-2 font-display text-[11px] font-bold text-ink transition peer-checked:bg-ink peer-checked:text-card">
        {label}
      </span>
    </label>
  );
}

const initialState: ActionResult = {};

export function PollComposer({ groupId }: { groupId: string }) {
  const { t } = useI18n();
  const TYPE_INFO = typeInfo(t);
  const [type, setType] = useState<PollType>("single");
  const [optionIds, setOptionIds] = useState<string[]>(() => ["a", "b"]);
  const [allowOptionAdds, setAllowOptionAdds] = useState(false);
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const idBase = useId();

  const action = useMemo(() => createPoll.bind(null, groupId, type), [groupId, type]);
  const [state, formAction, pending] = useActionState(action, initialState);

  const minOptions = MIN_OPTIONS[type];

  function addOptionField() {
    setOptionIds((ids) => [...ids, `${idBase}-${ids.length}-${Date.now()}`]);
  }
  function removeOptionField(id: string) {
    setOptionIds((ids) => (ids.length > minOptions ? ids.filter((x) => x !== id) : ids));
  }

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {/* --- Type picker -------------------------------------------------- */}
      <div>
        <label className="text-sm font-bold text-muted">{t.pollComposer.pollType}</label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(Object.keys(TYPE_INFO) as PollType[]).map((tOpt) => (
            <button
              key={tOpt}
              type="button"
              onClick={() => {
                setType(tOpt);
                if (optionIds.length < MIN_OPTIONS[tOpt]) {
                  setOptionIds((ids) => {
                    const needed = MIN_OPTIONS[tOpt] - ids.length;
                    return [...ids, ...Array.from({ length: needed }, (_, i) => `extra-${i}-${Date.now()}`)];
                  });
                }
              }}
              style={{ background: TYPE_COLORS[tOpt].bg }}
              className={`flex flex-col items-start rounded-[20px] border-2 p-4 text-start transition ${
                type === tOpt ? "border-ink" : "border-transparent"
              }`}
            >
              <div
                style={{ background: TYPE_COLORS[tOpt].fg }}
                className="flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <TypeIcon type={tOpt} />
              </div>
              <div className="mt-3 font-display text-sm font-bold text-ink">{TYPE_INFO[tOpt].label}</div>
              <div className="mt-1 text-xs font-semibold leading-snug text-muted">{TYPE_INFO[tOpt].blurb}</div>
            </button>
          ))}
        </div>
      </div>

      {/* --- Question / description ---------------------------------------- */}
      <div className="space-y-3">
        <div>
          <label htmlFor="question" className="text-xs font-bold text-muted">
            {t.pollComposer.question}
          </label>
          <input
            id="question"
            name="question"
            required
            maxLength={300}
            placeholder={t.pollComposer.questionPlaceholder}
            className="mt-1.5 w-full rounded-2xl border-2 border-border bg-surface px-3.5 py-3 text-sm font-bold text-ink placeholder:text-muted-2"
          />
        </div>
        <div>
          <label htmlFor="description" className="text-xs font-bold text-muted">
            {t.pollComposer.description} <span className="font-semibold text-muted-2">{t.pollComposer.optional}</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={2000}
            className="mt-1.5 w-full resize-none rounded-2xl border-2 border-border bg-surface px-3.5 py-3 text-sm font-semibold text-ink"
          />
        </div>
      </div>

      {/* --- Color ------------------------------------------------------------ */}
      <div>
        <ColorPicker value={color} onChange={setColor} label={t.pollComposer.pollColor} />
        <input type="hidden" name="color" value={color} />
      </div>

      {/* --- Options -------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-muted">
            {t.pollComposer.options} {type === "bracket" && <span className="font-semibold text-muted-2">{t.pollComposer.minFour}</span>}
          </label>
          <button type="button" onClick={addOptionField} className="font-display text-xs font-bold text-accent">
            {t.pollComposer.addOption}
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {optionIds.map((id, i) => (
            <div key={id} className="flex items-center gap-2">
              <input
                name="option"
                required
                maxLength={200}
                placeholder={t.pollComposer.optionPlaceholder(i + 1)}
                className="w-full rounded-2xl border-2 border-border bg-surface px-3.5 py-2.5 text-sm font-bold text-ink placeholder:text-muted-2"
              />
              {optionIds.length > minOptions && (
                <button
                  type="button"
                  onClick={() => removeOptionField(id)}
                  aria-label={t.pollComposer.removeOption}
                  className="shrink-0 text-lg text-muted-2 hover:text-danger"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- Settings --------------------------------------------------------- */}
      <fieldset className="space-y-3.5 rounded-[18px] border-2 border-border bg-surface p-4">
        <legend className="px-1 font-display text-xs font-bold text-muted">{t.pollComposer.settings}</legend>

        <label className="flex items-center justify-between gap-3 text-sm font-bold text-ink">
          {t.pollComposer.letOthersAddOptions}
          <Toggle name="allow_option_adds" checked={allowOptionAdds} onChange={setAllowOptionAdds} />
        </label>

        {allowOptionAdds && (
          <label className="ms-2 flex items-center justify-between gap-3 text-xs font-bold text-muted">
            {t.pollComposer.requireApproval}
            <Toggle name="option_adds_need_approval" />
          </label>
        )}

        {type !== "bracket" && (
          <label className="flex items-center justify-between gap-3 text-sm font-bold text-ink">
            {t.pollComposer.letPeopleChangeVote}
            <Toggle name="allow_vote_change" defaultChecked />
          </label>
        )}

        <label className="flex items-center justify-between gap-3 text-sm font-bold text-ink">
          {t.pollComposer.hideWhoVoted}
          <Toggle name="anonymous" />
        </label>

        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t.pollComposer.resultsVisible}</p>
          <div className="flex gap-1.5">
            <VisibilityOption value="always" label={t.pollComposer.visibilityAlways} defaultChecked />
            <VisibilityOption value="after_vote" label={t.pollComposer.visibilityAfterVote} />
            <VisibilityOption value="after_close" label={t.pollComposer.visibilityAfterClose} />
          </div>
        </div>

        {type === "multi" && (
          <div className="flex items-center gap-3 text-xs font-bold text-muted">
            <label className="flex flex-1 flex-col gap-1">
              {t.pollComposer.minPicks}
              <input
                type="number"
                name="min_picks"
                min={1}
                defaultValue={1}
                className="w-full rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-ink"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              {t.pollComposer.maxPicks}
              <input
                type="number"
                name="max_picks"
                min={1}
                defaultValue={3}
                className="w-full rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-ink"
              />
            </label>
          </div>
        )}

        {type === "rank" && (
          <label className="flex items-center justify-between gap-3 text-xs font-bold text-muted">
            {t.pollComposer.onlyRequireTop}
            <input
              type="number"
              name="top_n"
              min={1}
              placeholder={t.pollComposer.topNPlaceholder}
              className="w-20 rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-ink"
            />
          </label>
        )}
      </fieldset>

      {state?.error && <p className="text-sm font-bold text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[18px] bg-ink px-4 py-4 font-display text-sm font-bold text-card transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t.pollComposer.posting : t.pollComposer.submit}
      </button>
    </form>
  );
}
