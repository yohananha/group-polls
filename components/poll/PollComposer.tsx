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

function typeInfo(t: Dictionary): Record<PollType, { label: string; blurb: string }> {
  return t.pollComposer.types;
}

const initialState: ActionResult = {};

export function PollComposer({ groupId }: { groupId: string }) {
  const { t } = useI18n();
  const TYPE_INFO = typeInfo(t);
  const [type, setType] = useState<PollType>("single");
  const [optionIds, setOptionIds] = useState<string[]>(() => ["a", "b"]);
  const [allowOptionAdds, setAllowOptionAdds] = useState(false);
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
        <label className="text-sm font-medium">{t.pollComposer.pollType}</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              className={`rounded-lg border px-3 py-2 text-start text-xs transition ${
                type === tOpt
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              }`}
            >
              <div className="font-semibold">{TYPE_INFO[tOpt].label}</div>
              <div className="mt-0.5 opacity-80">{TYPE_INFO[tOpt].blurb}</div>
            </button>
          ))}
        </div>
      </div>

      {/* --- Question / description ---------------------------------------- */}
      <div className="space-y-3">
        <div>
          <label htmlFor="question" className="text-sm font-medium">
            {t.pollComposer.question}
          </label>
          <input
            id="question"
            name="question"
            required
            maxLength={300}
            placeholder={t.pollComposer.questionPlaceholder}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="description" className="text-sm font-medium">
            {t.pollComposer.description}{" "}
            <span className="font-normal text-neutral-400">{t.pollComposer.optional}</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
      </div>

      {/* --- Options -------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {t.pollComposer.options}{" "}
            {type === "bracket" && <span className="font-normal text-neutral-400">{t.pollComposer.minFour}</span>}
          </label>
          <button
            type="button"
            onClick={addOptionField}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
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
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              {optionIds.length > minOptions && (
                <button
                  type="button"
                  onClick={() => removeOptionField(id)}
                  aria-label={t.pollComposer.removeOption}
                  className="shrink-0 text-neutral-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- Settings --------------------------------------------------------- */}
      <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">{t.pollComposer.settings}</legend>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allow_option_adds"
            checked={allowOptionAdds}
            onChange={(e) => setAllowOptionAdds(e.target.checked)}
            className="rounded border-neutral-300"
          />
          {t.pollComposer.letOthersAddOptions}
        </label>

        {allowOptionAdds && (
          <label className="ms-6 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              name="option_adds_need_approval"
              className="rounded border-neutral-300"
            />
            {t.pollComposer.requireApproval}
          </label>
        )}

        {type !== "bracket" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allow_vote_change"
              defaultChecked
              className="rounded border-neutral-300"
            />
            {t.pollComposer.letPeopleChangeVote}
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="anonymous" className="rounded border-neutral-300" />
          {t.pollComposer.hideWhoVoted}
        </label>

        <div>
          <label htmlFor="results_visibility" className="text-sm">
            {t.pollComposer.resultsVisible}
          </label>
          <select
            id="results_visibility"
            name="results_visibility"
            defaultValue="always"
            className="ms-2 rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="always">{t.pollComposer.visibilityAlways}</option>
            <option value="after_vote">{t.pollComposer.visibilityAfterVote}</option>
            <option value="after_close">{t.pollComposer.visibilityAfterClose}</option>
          </select>
        </div>

        {type === "multi" && (
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              {t.pollComposer.minPicks}
              <input
                type="number"
                name="min_picks"
                min={1}
                defaultValue={1}
                className="w-16 rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex items-center gap-2">
              {t.pollComposer.maxPicks}
              <input
                type="number"
                name="max_picks"
                min={1}
                defaultValue={3}
                className="w-16 rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
          </div>
        )}

        {type === "rank" && (
          <label className="flex items-center gap-2 text-sm">
            {t.pollComposer.onlyRequireTop}
            <input
              type="number"
              name="top_n"
              min={1}
              placeholder={t.pollComposer.topNPlaceholder}
              className="w-16 rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        )}
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t.pollComposer.posting : t.pollComposer.submit}
      </button>
    </form>
  );
}
