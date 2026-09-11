#!/usr/bin/env bash
set -u

echo "==============================================="
echo "MCP-PTB - Installer de prerrequisitos"
echo "==============================================="
echo

is_cmd() {
  command -v "$1" >/dev/null 2>&1
}

ask_yes_no() {
  local prompt="$1"
  local answer
  read -r -p "$prompt [y/N]: " answer
  case "${answer:-}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

run_sudo() {
  if is_cmd sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

refresh_shell_hint() {
  echo "[INFO] Si instalaste algo que no aparece aun, recarga shell con: source ~/.bashrc"
}

manual_admin_hint() {
  local cmd="$1"
  echo "[INFO] Ejecuta en modo admin/root si aplica: $cmd"
}

install_node() {
  echo "[INFO] Intentando instalar Node.js LTS con todos los metodos conocidos..."

  if is_cmd apt-get; then
    echo "[TRY] apt-get (repos del sistema)"
    run_sudo apt-get update && run_sudo apt-get install -y nodejs npm && return 0
  fi

  if is_cmd dnf; then
    echo "[TRY] dnf"
    run_sudo dnf install -y nodejs npm && return 0
  fi

  if is_cmd yum; then
    echo "[TRY] yum"
    run_sudo yum install -y nodejs npm && return 0
  fi

  if is_cmd pacman; then
    echo "[TRY] pacman"
    run_sudo pacman -Sy --noconfirm nodejs npm && return 0
  fi

  if is_cmd zypper; then
    echo "[TRY] zypper"
    run_sudo zypper --non-interactive install nodejs npm && return 0
  fi

  if is_cmd snap; then
    echo "[TRY] snap"
    run_sudo snap install node --classic && return 0
  fi

  if is_cmd brew; then
    echo "[TRY] linuxbrew/homebrew"
    brew install node && return 0
  fi

  if is_cmd asdf; then
    echo "[TRY] asdf"
    asdf plugin add nodejs >/dev/null 2>&1 || true
    asdf install nodejs latest:lts && asdf global nodejs latest:lts && return 0
  fi

  if is_cmd volta; then
    echo "[TRY] volta"
    volta install node && volta install npm && return 0
  fi

  if is_cmd nvm; then
    echo "[TRY] nvm"
    nvm install --lts && nvm use --lts && return 0
  fi

  if is_cmd fnm; then
    echo "[TRY] fnm"
    fnm install --lts && fnm use lts-latest && return 0
  fi

  if is_cmd curl; then
    if is_cmd apt-get; then
      echo "[TRY] NodeSource setup script (Debian/Ubuntu)"
      curl -fsSL https://deb.nodesource.com/setup_lts.x | run_sudo bash - && run_sudo apt-get install -y nodejs && return 0
    fi

    echo "[TRY] Binario oficial Node.js en HOME"
    local tmp_dir
    local latest
    local tarball
    tmp_dir="$(mktemp -d 2>/dev/null || echo /tmp/mcp-node-installer)"
    mkdir -p "$tmp_dir"
    latest="$(curl -fsSL https://nodejs.org/dist/latest-v20.x/ 2>/dev/null | sed -n 's/.*href="\(node-v20[^"[:space:]]*linux-x64.tar.xz\)".*/\1/p' | head -n 1)"
    if [ -n "${latest:-}" ]; then
      tarball="$tmp_dir/$latest"
      curl -fsSL "https://nodejs.org/dist/latest-v20.x/$latest" -o "$tarball" && \
      mkdir -p "$HOME/.local/node" && \
      tar -xJf "$tarball" -C "$HOME/.local/node" --strip-components=1 && \
      ensure_user_path_contains "$HOME/.local/node/bin" && return 0
    fi
  fi

  return 1
}

ensure_user_path_contains() {
  local path_to_add="$1"
  local shell_rc

  if echo ":$PATH:" | grep -q ":$path_to_add:"; then
    echo "[OK] PATH ya contiene: $path_to_add"
    return 0
  fi

  echo "[WARN] PATH no contiene: $path_to_add"

  if ask_yes_no "Deseas agregarlo a tu PATH de usuario (~/.bashrc)"; then
    shell_rc="$HOME/.bashrc"
    {
      echo
      echo "# MCP-PTB installer"
      echo "export PATH=\"$path_to_add:\$PATH\""
    } >> "$shell_rc"
    echo "[OK] PATH agregado en $shell_rc"
    echo "[INFO] Ejecuta: source $shell_rc"
  else
    echo "[INFO] Si quieres PATH global del sistema, hazlo como admin:"
    echo "       sudo sh -c 'echo ""export PATH=\"$path_to_add:\$PATH\""" >> /etc/profile'"
  fi
}

npm_global_install_with_fallback() {
  local pkg="$1"
  local cmd_name_a="$2"
  local cmd_name_b="${3:-}"

  cli_available() {
    if is_cmd "$cmd_name_a"; then
      return 0
    fi
    if [ -n "$cmd_name_b" ] && is_cmd "$cmd_name_b"; then
      return 0
    fi
    return 1
  }

  echo "[TRY] npm install -g $pkg"
  if npm install -g "$pkg"; then
    if cli_available; then
      echo "[OK] $pkg instalado"
      return 0
    fi
  fi

  echo "[TRY] npm --location=global install -g $pkg"
  if npm --location=global install -g "$pkg"; then
    if cli_available; then
      echo "[OK] $pkg instalado"
      return 0
    fi
  fi

  echo "[TRY] sudo npm install -g $pkg"
  if is_cmd sudo && run_sudo npm install -g "$pkg"; then
    if cli_available; then
      echo "[OK] $pkg instalado"
      return 0
    fi
  fi

  echo "[WARN] Instalacion global fallo. Intentando con prefix de usuario..."
  mkdir -p "$HOME/.local/npm-global"
  npm config set prefix "$HOME/.local/npm-global"

  if npm install -g "$pkg"; then
    ensure_user_path_contains "$HOME/.local/npm-global/bin"
    if cli_available; then
      echo "[OK] $pkg instalado (modo usuario)"
      return 0
    fi
  fi

  if is_cmd pnpm; then
    echo "[TRY] pnpm add -g $pkg"
    if pnpm add -g "$pkg" && cli_available; then
      echo "[OK] $pkg instalado con pnpm"
      return 0
    fi
  fi

  if is_cmd yarn; then
    echo "[TRY] yarn global add $pkg"
    if yarn global add "$pkg" && cli_available; then
      echo "[OK] $pkg instalado con yarn"
      return 0
    fi
  fi

  if is_cmd bun; then
    echo "[TRY] bun add -g $pkg"
    if bun add -g "$pkg" && cli_available; then
      echo "[OK] $pkg instalado con bun"
      return 0
    fi
  fi

  echo "[ERROR] No se pudo instalar $pkg automaticamente."
  manual_admin_hint "sudo npm install -g $pkg"
  return 1
}

check_node() {
  if is_cmd node && is_cmd npm; then
    echo "[OK] Node.js instalado: $(node -v)"
    echo "[OK] npm instalado: $(npm -v)"
    return 0
  fi

  echo "[WARN] Node.js o npm no instalado."
  if ! ask_yes_no "Deseas instalar Node.js LTS ahora"; then
    echo "[ERROR] Sin Node.js no puedo instalar Gemini/Copilot CLI."
    return 1
  fi

  if ! install_node; then
    echo "[ERROR] No se pudo instalar Node.js automaticamente."
    echo "[INFO] Instala manualmente desde: https://nodejs.org/"
    manual_admin_hint "sudo apt-get install -y nodejs npm"
    return 1
  fi

  if is_cmd node && is_cmd npm; then
    echo "[OK] Node.js instalado: $(node -v)"
    echo "[OK] npm instalado: $(npm -v)"
    return 0
  fi

  echo "[ERROR] Node.js/npm siguen sin estar disponibles en PATH."
  return 1
}

maybe_install_gemini() {
  if is_cmd gemini; then
    echo "[OK] Gemini CLI: instalado"
    return 0
  fi

  echo "[WARN] Gemini CLI no instalado"
  if ask_yes_no "Deseas instalar Gemini CLI ahora"; then
    npm_global_install_with_fallback "@google/gemini-cli" "gemini" "gemini" || true
  fi
}

maybe_install_copilot() {
  if is_cmd copilot || is_cmd github-copilot-cli; then
    echo "[OK] Copilot CLI: instalado"
    return 0
  fi

  echo "[WARN] Copilot CLI no instalado"
  if ask_yes_no "Deseas instalar Copilot CLI ahora"; then
    npm_global_install_with_fallback "@githubnext/github-copilot-cli" "copilot" "github-copilot-cli" || true
  fi
}

final_status() {
  echo
  echo "========= ESTADO FINAL ========="
  is_cmd node && echo "Node.js: instalado" || echo "Node.js: no instalado"
  is_cmd npm && echo "npm: instalado" || echo "npm: no instalado"
  is_cmd gemini && echo "Gemini CLI: instalado" || echo "Gemini CLI: no instalado"
  if is_cmd copilot || is_cmd github-copilot-cli; then
    echo "Copilot CLI: instalado"
  else
    echo "Copilot CLI: no instalado"
  fi
  echo "================================"
  refresh_shell_hint
}

check_node || exit 1

# NPM global user bin path often used by distros/config.
if [ -d "$HOME/.npm-global/bin" ]; then
  ensure_user_path_contains "$HOME/.npm-global/bin"
fi
if [ -d "$HOME/.local/npm-global/bin" ]; then
  ensure_user_path_contains "$HOME/.local/npm-global/bin"
fi

maybe_install_gemini
maybe_install_copilot
final_status
