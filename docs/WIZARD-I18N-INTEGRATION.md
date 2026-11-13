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

At this stage: 7 inherited game tests and 76 workspace/bridge/i18n checks pass; root/package builds pass. Default browser regression: 16 pass, 2 external-SCOUT cases explicitly skip. Four new locale cases verify exact work/source/approval/draft/player preservation, held-key release and Space, local preference and mobile/offline view. These use actual HERO renderer/physics and clearly marked DEMO work, not a provider model or human playtest.

Screenshots in `packages/workspace-ui/output/playwright/`: `i18n-workspace-{zh,en}.png`, `i18n-approval-{zh,en}.png` and `i18n-native-off-en-mobile.png`. Raw content is synthetic and retains its original language.

## Remaining combined gate

Keep #7 stacked on HERO #9 until #9 merges; then retarget to main and rerun CI. HERO game translations, BUILDER's two distinct navigable worlds, SCOUT public source events in the primary host, an isolated Windows fresh-checkout smoke run and human acceptance still need combined verification before closing #12/#10. Module tests do not prove that gate. No self-merge or force push.
