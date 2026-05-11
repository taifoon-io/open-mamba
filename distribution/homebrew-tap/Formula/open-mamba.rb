# Homebrew formula for open-mamba.
#
# This file lives in the open-mamba repo at distribution/homebrew-tap/Formula/.
# To turn it into a working `brew install`, copy it into a separate repo named
#   yawningmonsoon/homebrew-tap
# at the path Formula/open-mamba.rb. The release.yml GitHub Actions workflow
# auto-bumps the `url` and `sha256` fields when you push a new git tag.
#
# Once published:
#   brew tap yawningmonsoon/tap
#   brew install open-mamba

class OpenMamba < Formula
  desc     "Autonomous task bus for AI agents — durable queue, agent dispatch, cost log"
  homepage "https://open-mamba.dev"
  license  "MIT"

  # The release workflow rewrites these two lines on every tag push.
  url      "https://github.com/yawningmonsoon/open-mamba/archive/refs/tags/v0.1.0.tar.gz"
  sha256   "0000000000000000000000000000000000000000000000000000000000000000"

  head "https://github.com/yawningmonsoon/open-mamba.git", branch: "main"

  depends_on "rust" => :build

  def install
    # Build the engine binary and the wrapper script.
    system "cargo", "install", *std_cargo_args(path: "crates/mamba-api"), "--bin", "open-mamba"

    # The mamba shell wrapper boots the engine + does friendly things like
    # `mamba up` / `mamba down` / `mamba status` / `mamba logs`.
    bin.install "scripts/mamba"
  end

  def caveats
    <<~EOS
      open-mamba runs at http://localhost:1337.

      Quickstart:
        mamba up         # start the bus
        open http://localhost:1337
        mamba down       # stop it

      Need to talk to Claude? Make sure `claude` (Anthropic's CLI) and `gh`
      are installed and authenticated:
        brew install gh
        gh auth login
        claude /login

      Docs: https://open-mamba.dev/docs
      Pro tier with SSO + cost optimizer: https://taifoon.io/products/taifoon-mamba
    EOS
  end

  test do
    # Smoke test — the binary should print a version on `--version` or `-V`.
    output = shell_output("#{bin}/open-mamba --version 2>&1", 0).strip
    assert_match(/open-mamba/i, output)

    # The wrapper should at least respond to `--help` without exploding.
    assert_match(/mamba/i, shell_output("#{bin}/mamba --help 2>&1", 0))
  end
end
