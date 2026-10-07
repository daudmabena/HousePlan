import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests/connected',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:3002',...devices['Desktop Chrome'],launchOptions:{channel:'chrome',args:['--no-proxy-server']},screenshot:'only-on-failure'}});
