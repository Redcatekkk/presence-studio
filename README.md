<div align="center">

# Redcatekkk

**Building practical dev tools.**  
TypeScript • Node.js • Tauri • Rust • CI

<p>
  <a href="https://github.com/Redcatekkk">
    <img src="https://img.shields.io/badge/GitHub-Redcatekkk-181717?style=for-the-badge&logo=github" />
  </a>
  <a href="https://www.npmjs.com/~redcatekkk">
    <img src="https://img.shields.io/badge/npm-%40redcatekkk-CB3837?style=for-the-badge&logo=npm" />
  </a>
  <a href="https://cordtools.online">
    <img src="https://img.shields.io/badge/CordTools-online-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  </a>
</p>

<img src="https://github-readme-stats.vercel.app/api?username=Redcatekkk&show_icons=true&theme=tokyonight&hide_border=true" height="165" />
<img src="https://github-readme-streak-stats.herokuapp.com?user=Redcatekkk&theme=tokyonight&hide_border=true" height="165" />

</div>

---

## Featured projects

### Presence Studio — Safe Discord Rich Presence designer

Build, preview, save, and run custom Discord Rich Presence profiles without user tokens. Presence Studio is a polished Tauri desktop app with real Discord IPC, profile storage, live preview, startup controls, notifications, and tray support.

<p>
  <a href="https://github.com/Redcatekkk/presence-studio">
    <img src="https://img.shields.io/badge/Repo-presence--studio-8b5cf6?style=for-the-badge&logo=github" />
  </a>
  <a href="https://cordtools.online">
    <img src="https://img.shields.io/badge/CordTools-online-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  </a>
  <img src="https://img.shields.io/badge/Tauri-Desktop-FFC131?style=for-the-badge&logo=tauri&logoColor=111827" />
</p>

```bash
git clone https://github.com/Redcatekkk/presence-studio.git
cd presence-studio
npm install
npm run tauri dev
```

**Presence Studio highlights**

- Real Discord Rich Presence through the local Discord desktop IPC bridge
- No Discord user tokens, no account impersonation, no unsafe auth flows
- Live Discord-style preview with editable details, state, images, timestamps, and buttons
- Local profiles, settings persistence, native notifications, launch at login, and tray hide/show
- Default Discord image keys: `presence-studio` and `cordtools-icon`

### envx — Prevent env drift in PRs

Gate undocumented env keys, generate schema/types, and scan for secrets.

<p>
  <a href="https://github.com/Redcatekkk/envx">
    <img src="https://img.shields.io/badge/Repo-envx-0ea5e9?style=for-the-badge" />
  </a>
  <a href="https://www.npmjs.com/package/@redcatekkk/envx">
    <img src="https://img.shields.io/badge/npm-%40redcatekkk%2Fenvx-CB3837?style=for-the-badge&logo=npm" />
  </a>
  <a href="https://github.com/Redcatekkk/envx/actions/workflows/envx.yml">
    <img src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" />
  </a>
</p>

```bash
npx @redcatekkk/envx --help
```

## Stack & flows I love

### Stack

<p>
  <img src="https://img.shields.io/badge/JavaScript-0b1220?style=for-the-badge&logo=javascript&logoColor=F7DF1E" />
  <img src="https://img.shields.io/badge/TypeScript-0b1220?style=for-the-badge&logo=typescript&logoColor=3178C6" />
  <img src="https://img.shields.io/badge/React-0b1220?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Next.js-0b1220?style=for-the-badge&logo=next.js&logoColor=ffffff" />
  <img src="https://img.shields.io/badge/Tauri-0b1220?style=for-the-badge&logo=tauri&logoColor=FFC131" />
  <img src="https://img.shields.io/badge/Rust-0b1220?style=for-the-badge&logo=rust&logoColor=CE412B" />
</p>

<p>
  <img src="https://img.shields.io/badge/Node.js-0b1220?style=for-the-badge&logo=node.js&logoColor=339933" />
  <img src="https://img.shields.io/badge/npm-0b1220?style=for-the-badge&logo=npm&logoColor=CB3837" />
  <img src="https://img.shields.io/badge/Git-0b1220?style=for-the-badge&logo=git&logoColor=F05032" />
  <img src="https://img.shields.io/badge/GitHub_Actions-0b1220?style=for-the-badge&logo=githubactions&logoColor=2088FF" />
  <img src="https://img.shields.io/badge/ESLint-0b1220?style=for-the-badge&logo=eslint&logoColor=4B32C3" />
  <img src="https://img.shields.io/badge/Prettier-0b1220?style=for-the-badge&logo=prettier&logoColor=F7B93E" />
</p>

<p>
  <img src="https://img.shields.io/badge/Tailwind_CSS-0b1220?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-0b1220?style=for-the-badge&logo=shadcnui&logoColor=ffffff" />
</p>

### Flows

- **Build -> ship:** small features, fast iterations, frequent releases
- **DX first:** clean CLI output, good defaults, copy-paste docs, zero friction setup
- **CI-first:** automate the boring stuff, especially checks that prevent production mistakes
- **Type-safe by default:** schemas + types as a source of truth with Zod / TypeScript
- **Desktop apps:** love the web UI + native performance vibe with Tauri + Rust

## Presence Studio development

```bash
npm install
npm run dev
npm run tauri dev
```

## Presence Studio checks

```bash
npm run build
npm run lint
cd src-tauri
cargo check
cargo test
```
