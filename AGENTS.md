# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/intent.md`: what we're building
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far

Update `docs/STATUS.md` when you finish a piece of work

## Testing

Run `npm test` from the repo root before calling any work done. It runs every suite, even after one fails, and exits with an error if any failed:

- backend unit tests (pytest, `backend/tests/`), also `npm run test:backend`
- frontend unit tests (Vitest, `frontend/src/**/*.test.ts(x)`), also `npm run test:frontend`
- end-to-end tests (Playwright in installed Chrome, `e2e/`), also `npm run test:e2e`

The tests use their own database and ports, so the app can stay running. Fix failures until `npm test` passes.
