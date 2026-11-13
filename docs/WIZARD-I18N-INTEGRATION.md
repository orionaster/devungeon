# WIZARD wave 2 · shared locale contract

2026-11-14 · Issues #12/#10 · ADR-0002 / PRD v1.3. Feature-branch evidence, not a main release or human acceptance.

## Shared API and ownership

Use one `I18nProvider` around the application root. Import `I18nProvider`, `useI18n`, `LocaleSwitcher`, `Locale`, `TranslationKey` and `TranslationParams` from `@devungeon/workspace-ui/i18n` (or the relative `packages/workspace-ui/src/i18n` entry before workspace integration).

`useI18n()` returns `{locale,setLocale,t,formatTime,formatDateTime}`. Pure `translate(locale,key,params)` and `formatSourceTime` import no React. Keys are a finite catalogue union, params are string/number values. Built-in Intl handles dates and one/other plurals. Missing resources fall back to Chinese then visible `[key]`; missing placeholders remain visible. Parity tests validate keys, placeholders and plural forms; warnings omit interpolation values.

Fresh visitors default to zh-CN regardless of browser language. Only `devungeon.locale.v1` is persisted locally. Invalid/unavailable storage is tolerated. Changing locale updates HTML lang and display, without reloading or keying/remounting children. Legacy unwrapped hosts remain Chinese and warn on a switch attempt; proper integration requires the shared provider. The switcher's accessible group name is `界面语言 / Interface language`. Keyup reaches the host's held-key cleanup; a language control must not leave W held or trigger a dodge/attack.

- WIZARD owns the core, shared/workspace/world resources, workspace and independent host. Core commit `4e8fb12` was supplied separately for HERO synchronization.
- HERO owns `apps/web/src/main.tsx` provider mount, menu/HUD/help/room translations and `src/i18n/game-catalogue.ts`; the shared catalogue combines that file. Do not create a second locale store.
- BUILDER emits agreed `world.*` display keys/params separately from source IDs/compiler inputs. Unknown verification copy means v1 lacks per-feature verification time/confidence; supplied evidence flags remain unchanged.
- SCOUT keeps source snapshots/events renderer-neutral. Only display labels use locale. Project-source records never become Agent actors.

Keep locale/t out of Dungeon/controller construction effects, source connection effects, compiler inputs and seeds. Locale is separate from world selection. This wave retains the first pixel dungeon and adds no second pack, selector or gameplay loop.

## Source and authority invariants

Source IDs/enums/times, chat drafts, raw replies, command payloads, approval command/scope/reason and evidence links remain unchanged. Local faults carry a display key while retaining their original diagnostic. Arbitrary source text is explicitly marked Original, not silently translated. Only three exact authored initial DEMO task records receive static bilingual display copy; identity and exact source text must both match. User tasks and altered source records do not take that path. Original records remain available. Language controls call neither send nor decide.

The experimental Codex connector stays off. **Real provider control is not a gate for Issue #12.** No private Crew, provider account/config or model requests are accessed by this wave; a future real command loop still needs separately scoped authorization and actual proof.

## Reproduction and evidence

Use root `npm ci --ignore-scripts`, root `npm test` / `npm run build`, then `npm test --workspace @devungeon/workspace-ui`, `npm run build --workspace @devungeon/workspace-ui` and `npm run test:browser --workspace @devungeon/workspace-ui`. Set `PW_CHANNEL=chrome` to use installed Chrome, and leave `DEVUNGEON_CODEX_TEXT_TRIAL` empty. Use the supervisor's isolated fresh-checkout environment when active Windows worktrees hold node_modules locks. No i18n dependency or extra lockfile is introduced; React/React DOM remain deduplicated at 19.3.1.

HERO `4d45bd4` has now been merged into WIZARD without rewriting history. `App` remains the reusable scene/event/inspection host. `WorkspaceGame.tsx` is the thin default composition, injecting the separately owned controller and disabling the independent S1 animation script. The primary entry mounts the shared provider once. A renderer activity gate still suppresses cached work animation on source disconnect/stale. `onClose` changes selection; optional `onRestoreFocus` runs after Radix releases the sheet and uses HERO's `restoreFocus` port. This fixes returning from a party-row-opened workspace by keyboard without losing movement focus. Inspection pauses local combat, never work.

Current checks: **9 engine tests**, **19 root i18n tests** and **76 workspace/bridge/i18n tests** pass (the root i18n subset is included in the workspace count). Root/package builds pass. Windows Chrome regression: **17 pass, 2 external-SCOUT cases explicitly skip**. Two primary-entry cases were run against the actual root dev origin `http://127.0.0.1:5178` using `PRIMARY_APP_URL`; they do not use the alternate room. They cover menu/HUD/locked-room/workspace language changes, full paused GameSnapshot and work/approval equality, continued movement and restoring canvas focus after keyboard dismissal. Four separate locale cases also cover held-key cleanup, Space, stored preference, missing-source/mobile view and source preservation. All are agent-driven tests, not provider or human acceptance.

Screenshots in `packages/workspace-ui/output/playwright/`: `i18n-workspace-{zh,en}.png`, `i18n-approval-{zh,en}.png` and `i18n-native-off-en-mobile.png`. Raw content is synthetic and retains its original language.

The primary host additionally has actual `primary-{entry,hud,locked-room,workspace,approval}-{zh,en}.png` pairs. Run the root dev server on a chosen local port, then set `PRIMARY_APP_URL=http://127.0.0.1:5178` for the two `primary-*.spec.ts` tests. Without that variable CI imports the same `WorkspaceGame` entry in the independent development host. Neither path supplies a fake renderer or provider.

## Remaining combined gate

Keep #7 stacked on HERO #9 until #9 merges; then retarget to main and rerun CI. BUILDER's two distinct navigable worlds and SCOUT public source events still need assembling in this same primary host, followed by the supervisor's isolated Windows fresh-checkout smoke run and human acceptance before closing #12/#10. WIZARD's primary bilingual/workspace tests do not prove that whole gate. No self-merge or force push.
