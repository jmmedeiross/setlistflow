import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const storage = mkdtempSync(path.join(tmpdir(), 'setlistflow-e2e-'));
const dotnet = process.env.DOTNET_EXE || 'dotnet';
const dll = process.env.SETLISTFLOW_TEST_DLL || path.join(root, 'src/SetlistFlow.Api/bin/Release/net10.0/SetlistFlow.Api.dll');
function server(port, readOnly) {
  return {
    command: `"${dotnet}" "${dll}" --urls http://127.0.0.1:${port}`,
    cwd: path.join(root, 'src/SetlistFlow.Api'),
    url: `http://127.0.0.1:${port}/api/health`,
    env: { SETLISTFLOW_DB: path.join(storage, `${port}.db`), SETLISTFLOW_READ_ONLY: String(readOnly), PORT: '' },
    reuseExistingServer: false,
    timeout: 30000
  };
}
export default defineConfig({
  testDir: './tests/browser',
  outputDir: process.env.E2E_RESULTS || 'test-results',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'workspace', testMatch: 'workspace.spec.mjs', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5197' } },
    { name: 'public-mobile', testMatch: 'public.spec.mjs', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', baseURL: 'http://127.0.0.1:5198' } }
  ],
  webServer: [server(5197, false), server(5198, true)]
});
