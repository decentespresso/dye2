import assert from 'node:assert/strict';
import { resolveThemeSource, themeBootstrap } from '../src/utils/theme.ts';

const { resolveTheme } = new Function(resolveThemeSource + '\nreturn { resolveTheme };')();

assert.equal(resolveTheme({ param: 'dark', cached: 'light' }).theme, 'dark', 'param wins over cache');
assert.equal(resolveTheme({ param: 'light', cached: 'dark', remote: 'dark' }).theme, 'light', 'param wins over remote too');
assert.equal(resolveTheme({ cached: 'dark' }).theme, 'dark', 'cache used when no param');
assert.equal(resolveTheme({}).theme, 'light', 'light by default');
assert.equal(resolveTheme({ param: null, cached: null }).theme, 'light', 'nulls are absent');
assert.equal(resolveTheme({ param: 'blue', cached: 'DARK' }).theme, 'light', 'junk falls back to light');
assert.equal(resolveTheme({ param: 'blue', cached: 'dark' }).theme, 'dark', 'junk param falls through to cache');
assert.equal(resolveTheme({ cached: 'light', remote: 'dark' }).theme, 'dark', 'remote applied when it differs from the cache');
assert.equal(resolveTheme({ cached: 'dark', remote: '' }).theme, 'dark', 'junk remote keeps the cache');
assert.equal(resolveTheme({ cached: 'dark', remote: 404 }).theme, 'dark', 'non-string remote is ignored');

assert.equal(resolveTheme({ cached: 'light', remote: 'dark' }).cache, 'dark', 'a usable remote is cached');
assert.equal(resolveTheme({ param: 'dark', remote: 'light' }).cache, 'light', 'cached even when a param overrides it');
assert.equal(resolveTheme({ param: 'dark', cached: 'light' }).cache, null, 'a param alone is never cached');
assert.equal(resolveTheme({ cached: 'dark', remote: 'junk' }).cache, null, 'junk remote is not cached');

// The bootstrap is an unchecked string: at least make sure it parses.
new Function(themeBootstrap);

console.log('theme: ok');
