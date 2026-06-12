import { defineConfig } from 'vite';

// base: './' keeps asset URLs relative, so the build works both locally
// (vite preview) and on GitHub Pages project sites (user.github.io/<repo>/)
// without needing to know the repository name.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
