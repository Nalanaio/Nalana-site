import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadPlatform } from '../src/lib/download-platform.js';

test('desktop installers follow the operating system',()=>{
  assert.equal(downloadPlatform({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}),'windows');
  assert.equal(downloadPlatform({platform:'Win32'}),'windows');
  assert.equal(downloadPlatform({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}),'mac');
  assert.equal(downloadPlatform({platform:'macOS'}),'mac');
});
test('mobile and tablets take priority over their desktop-like user agents',()=>{
  for(const device of [
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9)'},
    {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'},
    {platform:'MacIntel',maxTouchPoints:5,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'},
    {platform:'Windows',mobile:true},
  ])assert.equal(downloadPlatform(device),'both');
});
test('unknown operating systems retain useful native choices',()=>{
  assert.equal(downloadPlatform(),'both');
  assert.equal(downloadPlatform({platform:'Linux x86_64'}),'both');
});
