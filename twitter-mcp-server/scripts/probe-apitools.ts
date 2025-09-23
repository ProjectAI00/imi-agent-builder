#!/usr/bin/env ts-node-esm

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

type ProbeResult = {
  endpoint: string;
  method: 'GET'|'POST';
  exists: boolean;
  success: boolean;
  httpStatus?: number;
  message?: string;
  paramsTried: Record<string, any>;
  timestamp: string;
};

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'twitter-api-v1-1-enterprise.p.rapidapi.com';
const RAPIDAPI_BASE_URL = process.env.RAPIDAPI_BASE_URL || 'https://twitter-api-v1-1-enterprise.p.rapidapi.com';
const INTERNAL_KEY = process.env.TWITTER_INTERNAL_API_KEY || process.env.RAPIDAPI_TWITTER_APIKEY || '';

if (!RAPIDAPI_KEY) {
  console.error('RAPIDAPI_KEY missing');
  process.exit(2);
}

const args = process.argv.slice(2);
const userId = process.env.PROBE_USER_ID || '12';
const username = process.env.PROBE_USERNAME || 'jack';
const outDir = path.resolve(process.cwd(), '..', '.data');
const outFile = path.join(outDir, 'apitools-catalog.json');
fs.mkdirSync(outDir, { recursive: true });

const client = axios.create({
  baseURL: RAPIDAPI_BASE_URL,
  headers: {
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'X-RapidAPI-Host': RAPIDAPI_HOST,
    'Accept': 'application/json',
  },
  timeout: 15000,
  validateStatus: () => true,
});

const defaultEndpoints = [
  'search',
  'followersListV2', 'followingsListV2',
  'followersIds', 'followingsIds',
  'blueVerifiedFollowersV2',
];

function makeQueries(ep: string): Record<string, any>[] {
  const base: Record<string, any> = { resFormat: 'json' };
  if (INTERNAL_KEY) base.apiKey = INTERNAL_KEY;
  if (ep === 'search') {
    return [ { ...base, words: 'from:' + username, count: 1, topicId: 702 } ];
  }
  const idVariants = [
    { userId },
    { user_id: userId },
    { username },
    { screen_name: username },
  ];
  const countVariants = [ {}, { count: 10 }, { limit: 10 }, { max_results: 10 } ];
  const combos: Record<string, any>[] = [];
  for (const idv of idVariants) {
    for (const cv of countVariants) {
      combos.push({ ...base, ...idv, ...cv });
    }
  }
  return combos;
}

async function probeEndpoint(endpoint: string): Promise<ProbeResult> {
  const queries = makeQueries(endpoint);
  for (const q of queries) {
    const url = `/base/apitools/${endpoint}`;
    const res = await client.get(url, { params: q });
    const body = (typeof res.data === 'string') ? res.data : JSON.stringify(res.data);
    if (res.status === 200) {
      // Heuristic: if provider returns {message:"Missing required parameters"}, endpoint exists but params wrong
      const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (/Missing required parameters/i.test(txt)) {
        return { endpoint, method: 'GET', exists: true, success: false, httpStatus: res.status, message: 'Missing required parameters', paramsTried: q, timestamp: new Date().toISOString() };
      }
      return { endpoint, method: 'GET', exists: true, success: true, httpStatus: res.status, message: 'OK', paramsTried: q, timestamp: new Date().toISOString() };
    }
    if (/does not exist/i.test(body)) {
      return { endpoint, method: 'GET', exists: false, success: false, httpStatus: res.status, message: body, paramsTried: q, timestamp: new Date().toISOString() };
    }
    // try next param combo
  }
  return { endpoint, method: 'GET', exists: true, success: false, httpStatus: undefined, message: 'Tried variants; no success', paramsTried: {}, timestamp: new Date().toISOString() };
}

async function main() {
  const endpoints = args.length > 0 ? args : defaultEndpoints;
  const catalog: Record<string, ProbeResult> = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
  const results: ProbeResult[] = [];
  for (const ep of endpoints) {
    try {
      const r = await probeEndpoint(ep);
      catalog[ep] = r;
      results.push(r);
      console.log(`${ep}: ${r.success ? 'OK' : r.exists ? 'PARAMS?' : 'NO-ENDPOINT'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      catalog[ep] = { endpoint: ep, method: 'GET', exists: true, success: false, message: msg, paramsTried: {}, timestamp: new Date().toISOString() } as ProbeResult;
      console.log(`${ep}: ERROR ${msg}`);
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(catalog, null, 2));
  console.log(`\nWrote catalog: ${outFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

