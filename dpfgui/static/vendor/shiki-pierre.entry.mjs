// The highlighter dpf-dev-gui vendors: Shiki with only the grammars it needs, Pierre's themes,
// and the JavaScript regex engine (no WebAssembly).
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import yaml from '@shikijs/langs/yaml';
import json from '@shikijs/langs/json';
import shellscript from '@shikijs/langs/shellscript';
import systemd from '@shikijs/langs/systemd';
import ini from '@shikijs/langs/ini';
import markdown from '@shikijs/langs/markdown';
import pierreLight from '@pierre/theme/pierre-light';
import pierreDark from '@pierre/theme/pierre-dark';

export const LANGS = ['yaml', 'json', 'shellscript', 'systemd', 'ini', 'markdown'];
export function createHighlighter() {
  return createHighlighterCore({
    themes: [pierreLight, pierreDark],
    langs: [yaml, json, shellscript, systemd, ini, markdown],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
}
