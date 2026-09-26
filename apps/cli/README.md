# StarLab CLI

The official [StarLab](https://starlab.app) CLI — deploy, manage, and operate your StarLab instance.

[Website](https://starlab.app) | [Documentation](https://docs.starlab.app) | [GitHub](https://github.com/starlab/starlab)

<img width="915" height="871" alt="image" src="https://github.com/user-attachments/assets/957c6cea-3efb-4cab-a643-55df3ac4c6aa" />

## Quick Start

### One-line install

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/starlab/starlab/main/apps/cli/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/starlab/starlab/main/apps/cli/install.ps1 | iex
```

### Using npx

```bash
npx starlab@latest setup
```

### Install a specific version

```bash
npx starlab@1.0.0 setup
```

## Requirements

- **Node.js** >= 18
- **Docker**

## Commands

| Command | Description |
|---------|-------------|
| `starlab setup` | Interactive setup wizard |
| `starlab start` | Start all services |
| `starlab stop` | Stop all services |
| `starlab update` | Update to the latest version |
| `starlab update --version <x.y.z>` | Update to a specific version |
| `starlab logs` | Stream service logs |
| `starlab config` | Show current configuration |
| `starlab status` | Show service status |
| `starlab health` | Run health checks |
| `starlab backup` | Backup database |
| `starlab restore <archive>` | Restore database from a backup |
| `starlab deployments` | View deployments and set resource limits |
| `starlab doctor` | Diagnose common issues |
| `starlab shell` | Open a shell in a running container |
| `starlab env` | Edit environment variables |
| `starlab dev` | Start local development environment |

## Setup

The setup wizard walks through:

1. **Install directory** — where files are generated
2. **Domain** — hostname, port, HTTPS/SSL
3. **Database & Redis** — local (Docker) or external
4. **Organization** — name for your instance
5. **Admin account** — email and password
6. **Features** — AI, email, S3, OAuth, Unsplash

You can go back to any step, and edit from the summary before confirming.

## Updating

```bash
# Back up first
npx starlab backup

# Update to latest
npx starlab update

# Or a specific version
npx starlab update --version 1.2.0
```

The update command pulls the new image, restarts services, and asks if you want to run database migrations. Check [docs.starlab.app](https://docs.starlab.app) for migration guides before proceeding.

## Generated Files

```
starlab/
  docker-compose.yml       # Service definitions
  .env                     # Configuration
  starlab.config.json   # CLI metadata
  extra/
    nginx.prod.conf        # Reverse proxy (or Caddyfile for auto-SSL)
```

## CI / Non-interactive Mode

All commands support non-interactive usage for CI pipelines:

```bash
# Setup without prompts
npx starlab setup --ci \
  --name production \
  --domain example.com \
  --port 80 \
  --admin-email admin@example.com \
  --admin-password secretpass123

# Update with auto-migration
npx starlab update --version 1.2.0 --migrate

# Update without migrations
npx starlab update --no-migrate

# Setup without starting services
npx starlab setup --ci --admin-password pass123 --no-start
```

## Testing

```bash
# Unit tests (no Docker required)
bun run test

# E2E tests (requires Docker)
bun run test:e2e

# All tests
bun run test:all
```

**Unit tests** cover template generation (docker-compose, .env, nginx, caddyfile) and config store operations.

**E2E tests** run the full lifecycle with real Docker containers: setup → start → status → health → doctor → stop → restart. They use `--ci` mode to run without prompts.

**Not yet tested:**
- Interactive commands (backup create/restore, env editor, shell, deployments scaling)
- `update` with actual version swap between two published images
- `update --migrate` with pending Alembic migrations
- `logs` (streams indefinitely)
- `dev` mode (requires full monorepo source)
- Multi-installation discovery (`findInstallDir` with multiple `~/.starlab/*` entries)
- Error recovery (Docker daemon down, port conflicts, corrupted config)

## License

GPL-3.0
