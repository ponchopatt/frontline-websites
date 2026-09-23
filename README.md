# frontline-demos — generated, do not hand-edit

Plain static files, one folder per shipped demo. No build step, no
package.json — Vercel just serves this directory as-is, the same way
`demos/bondi-landscapes` is served on the live Bondi project.

Regenerated from the `factory` branch by `bin/build-demos-site.js`,
committed here, and pushed. To refresh after a new client ships:

```
git worktree add /tmp/wt demos-live
cd /tmp/wt
git rm -rq .
cp -r ../frontline-websites/dist-demos/. .
git add -A && git commit -m "Refresh shipped demos" && git push
```

Vercel import settings for this branch: Framework Preset **Other**,
Root Directory and Build Command both left blank, Production Branch
`demos-live`.
