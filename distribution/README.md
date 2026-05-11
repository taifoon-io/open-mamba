# open-mamba · distribution

Everything needed to make `brew install yawningmonsoon/tap/open-mamba` and
`curl -fsSL https://open-mamba.dev/install.sh | sh` work for real.

## What's here

```
distribution/
├── README.md                              # this file
├── homebrew-tap/Formula/open-mamba.rb     # the brew formula (canonical copy)
└── install.sh                             # one-line installer (host at /install.sh)
```

The matching GitHub Actions workflow lives at `.github/workflows/release.yml`
in the repo root — that's what wires it all together on tag push.

## How it ships

```
                  push tag v0.1.0
                         │
                         ▼
       ┌───────── .github/workflows/release.yml ─────────┐
       │                                                  │
       │  build matrix → 4 platform tarballs              │
       │       ↓                                          │
       │  attach to github release v0.1.0                 │
       │       ↓                                          │
       │  compute SHA256 of source tarball                │
       │       ↓                                          │
       │  open PR → yawningmonsoon/homebrew-tap           │
       │              with url + sha256 bumped            │
       └──────────────────────────────────────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        ▼                                   ▼
  brew install                     curl -fsSL
   yawningmonsoon/tap/             open-mamba.dev/install.sh
   open-mamba                       | sh
```

## One-time setup

You need to do these three things once before the first tag push:

### 1. Create the tap repo

```bash
gh repo create yawningmonsoon/homebrew-tap --public \
  --description "Homebrew tap for open-mamba" \
  --add-readme
```

(The repo's name **must** start with `homebrew-` for `brew tap` to find it.)

### 2. Create a fine-grained PAT and add it as a secret

Generate a fine-grained personal access token with these permissions on
`yawningmonsoon/homebrew-tap`:

- **Contents** · read & write
- **Pull requests** · read & write

Add it to the open-mamba repo as a secret named `HOMEBREW_TAP_PAT`:

```bash
gh secret set HOMEBREW_TAP_PAT -R yawningmonsoon/open-mamba
```

### 3. Host `install.sh` at `open-mamba.dev/install.sh`

Either:

- copy `distribution/install.sh` into the marketing site under
  `site/public/install.sh` (Next.js will serve it), or
- upload it to whatever's at `open-mamba.dev` directly.

## Cutting a release

```bash
# Bump versions, update CHANGELOG, then:
git tag -a v0.1.0 -m "open-mamba v0.1.0"
git push --tags
```

That's it. The workflow builds 4 platform binaries, attaches them to the
release, opens a PR against `yawningmonsoon/homebrew-tap`. Merge the PR and:

```bash
brew tap yawningmonsoon/tap
brew install open-mamba
```

…now actually works.

## Re-enabling marketing copy

Once the first release ships and you've verified `brew install` works
end-to-end, you can flip the install copy back. Search-and-replace these
strings across both sites:

```
$ GIT_CLONE_&&_CARGO_BUILD          →   $ BREW INSTALL OPEN-MAMBA
$ GIT_CLONE                         →   $ BREW INSTALL
git clone … && cd … && cargo build  →   brew install yawningmonsoon/tap/open-mamba
```

Files touched today (so you know where to look):

- `~/projects/open-mamba/site/app/page.tsx`
- `~/projects/open-mamba/site/app/docs/page.tsx`
- `~/projects/open-mamba/site/components/Nav.tsx`
- `~/projects/taifoon-mamba/ui/app/page.tsx`
- `~/projects/taifoon-mamba/ui/app/(marketing)/docs/page.tsx`
- `~/projects/taifoon-mamba/ui/app/(marketing)/products/open-mamba/page.tsx`

## License

MIT — same as the engine.
