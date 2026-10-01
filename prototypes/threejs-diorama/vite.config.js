import { defineConfig } from 'vite';

// base: './' … 書き出したもの（dist）を、どのフォルダに置いても動くように
export default defineConfig({
  base: './',
  server: { port: 5188 },
});
