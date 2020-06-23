require("babel-core/register");
require("babel-polyfill");

import App from './App.svelte';

const app = new App({
  target: document.body
});

export default app;
