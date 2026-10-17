# Still AI agent setup

The workflow `.github/workflows/still-ai-agent.yml` uses the official `openai/codex-action@v1` to implement a task in a GitHub Actions runner. It does **not** publish or commit changes; it saves a reviewable patch artifact.

## One-time owner setup
1. Create an OpenAI **API** key at https://platform.openai.com/api-keys (ChatGPT subscription and API billing are separate).
2. Go to this repository's Settings > Secrets and variables > Actions > New repository secret.
3. Name the secret `OPENAI_API_KEY` and paste the key there. Never put it in an issue, commit, chat, or workflow file.
4. Go to Actions > Still AI coding agent > Run workflow. Select the development branch `feat/hamsterbase-still-rebuild` and enter a narrowly scoped task.
5. Inspect the job logs and download the `Still-Agent-Review-Patch` artifact. Review the patch and apply it on a feature branch only after verifying it.

## Suggested first task
Integrate the existing BatchSelect.tsx into the Still task list and add accessible mobile select mode. Add tests, preserve current tasks and project data, and do not alter unrelated features.

## Limits
- The agent runs only on manual workflow dispatch by the repository owner.
- It consumes separately billed API usage and GitHub Actions minutes.
- The patch artifact is **not** an automatically merged pull request.
- Do not run on untrusted pull-request code with credentials.
- Confirm npm verification and APK/EXE builds before a release.
