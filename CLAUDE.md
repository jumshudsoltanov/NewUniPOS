# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UniPOS is a desktop POS (Point of Sale) application for Windows built with Electron + React. It uses a local MariaDB database with Sequelize ORM and syncs data to a central admin server (api.unipos.tech). It supports Master/Slave multi-terminal setups, network/USB/COM thermal receipt printers, tax devices (DataPay, Sunmi, Omnitech, OneClick), customer displays, and kitchen display systems.

## Key Architecture

### Monorepo Structure

```
POS-ReDesing/
├── electron/
│   ├── front/          # React SPA (Vite) — POS UI
│   │   ├── src/
│   │   │   ├── components/    # ~60+ React components organized per-feature
│   │   │   ├── redux/         # Redux Toolkit store + slices
│   │   │   ├── utils/         # ~20 utility modules
│   │   │   └── hooks/         # Custom hooks
│   │   ├── dist/              # Built frontend (served in production)
│   │   └── vite.config.js
│   ├── backend/        # Express.js API server (port 55667)
│   │   ├── app.js             # Entry: Express server, Sequelize sync, role detection
│   │   ├── router/AppRouter.js # All API routes (~100+ endpoints)
│   │   ├── controller/        # 15 controllers (business logic)
│   │   ├── model/             # 16 Sequelize models
│   │   ├── data/              # Data-fetch modules (sync from admin API)
│   │   ├── services/          # SyncService, MaxCheckService, TimerService
│   │   ├── socket/MasterServer.js  # Socket.io for Master/Slave comms
│   │   ├── database/config.js # MariaDB connection config
│   │   ├── taxs/              # Tax device integrations (4 providers)
│   │   ├── bot/whatsapp/      # WhatsApp integration
│   │   └── utils/             # Backend utilities
│   ├── server/         # Electron main process
│   │   └── main.js            # Window management, IPC, printing, auto-updates
│   ├── mobile/         # Expo React Native mobile app
│   └── static/images/  # Build-time assets (icons, etc.)
├── admin/routes/       # Additional admin ordering routes
├── scripts/            # Build scripts (icon prep, electron-builder)
└── dist/               # Built Windows installers (.exe)
```

### Core Flow

1. **Electron main process** (`electron/server/main.js`) creates the BrowserWindow, loads the React frontend (dev: localhost:5173, prod: dist/index.html), and provides IPC handlers for printer management, system info, and window control.
2. **Express backend** (`electron/backend/app.js`) starts on port 55667, connects to local MariaDB, syncs data from the admin API on startup, and handles all POS business logic.
3. **Master/Slave mode**: Master terminal runs a Socket.io server + UDP broadcaster. Slave terminals discover the Master via UDP/TCP scan and delegate printing to it.
4. **SyncService** periodically pushes orders/items/payments to the central admin API. Offline orders are queued with retry logic.

### Frontend Routing (React, HashRouter)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Login | PIN-less entry |
| `/pin` | Pin | PIN code authentication |
| `/blocked` | BlockPage | Blocked/payment-expired page |
| `/tables` | Tables (Layout) | Table grid view |
| `/checks` | Checks (Layout) | Active checks list |
| `/check/:id` | Check | Individual check detail |
| `/closecheck/:id` | CheckOver | Checkout/close check |
| `/settings` | Settings | Full settings panel |
| `/customer` | CustomerDisplay (lazy) | Customer-facing display (2nd monitor) |
| `/kitchen-display` / `/kds` / `/kitchen` | KitchenDisplay (lazy) | Kitchen display system |
| `/customer` | CustomerDisplay (lazy) | Customer-facing display (2nd monitor) |

### State Management (Redux Toolkit)

Slices in `electron/front/src/redux/Slices/`: LoginSlice, SaleSlice, OrdersSlice, MenuSlice, TablesSlice, BooksSlice, SyncSlice, WaitersSlice, CouriersSlice, CustomersSlice, PaymentMethodsSlice, SalesTypesSlice, TagsSlice.

### Printing System

- **Raster mode** (direct TCP/IP or COM): renders HTML receipt in a hidden BrowserWindow, captures as bitmap, converts to ESC/POS raster format, sends directly to printer via TCP socket or COM port.
- **Windows Driver mode**: renders receipt and uses Electron's `webContents.print()` with deviceName targeting a Windows-installed printer driver.
- Print queue persists to disk for retry when printer is offline.
- ZJ printer compat layer with configurable raster chunk sizes and insets.

### Tax Integrations

Four tax device providers in `electron/backend/taxs/`: DataPayService (bank card + fiscal), SunmiService, OmnitechService, OneClickService. `TaxManager` routes requests to the appropriate service based on taxConfig.

## Common Commands

```bash
# Development — starts Vite dev server + Electron
npm start

# Run frontend dev server only
npm run dev-react

# Build the React frontend
npm run build-front

# Build Windows installer
npm run dist

# Build portable EXE
npm run dist-portable

# Build without packaging (for testing)
npm run pack

# Lint frontend
npm run build-front && cd electron/front && npm run lint
```

Note: Electron main process is at `electron/server/main.js`, not `main.js` in root.
