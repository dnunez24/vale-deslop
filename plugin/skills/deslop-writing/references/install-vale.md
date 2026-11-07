# Install Vale

The skill needs Vale 3.21.0 or newer on `PATH`.
Check with `vale --version`.
Offer one command from this list, and run it only after the user approves.

## Commands by platform

| Platform             | Command                         |
| -------------------- | ------------------------------- |
| macOS                | `brew install vale`             |
| Linux (Homebrew)     | `brew install vale`             |
| Linux (Snap)         | `sudo snap install vale`        |
| Windows (winget)     | `winget install errata-ai.Vale` |
| Windows (Chocolatey) | `choco install vale`            |

## Release binary (any platform)

1. Open <https://github.com/vale-cli/vale/releases/latest>.
2. Download the archive for the platform:
   `vale_<version>_Linux_64-bit.tar.gz`, `vale_<version>_Linux_arm64.tar.gz`, `vale_<version>_macOS_arm64.tar.gz`, `vale_<version>_macOS_64-bit.tar.gz`, `vale_<version>_Windows_64-bit.zip`, or `vale_<version>_Windows_arm64.zip`.
3. Unpack it and put the `vale` binary in a directory on `PATH`.
4. Run `vale --version` to confirm.

## After install

Open a new shell if `vale` isn't found, because the install may have changed `PATH`.
Run `vale --version` again.
If the version is still older than 3.21.0 or the command fails, report that once and continue in inference-only mode.
