# Loca Box Tracker (lease-management-app)

Expo React Native client for the Loca Box lease workflow. Data is stored in the
cloud via **loca-box-backend** (Go + MongoDB). The app uses **Redux Toolkit**
(`createAsyncThunk` + `axiosInstance`) for auth and all API calls.

## Prerequisites

1. Run [loca-box-backend](../loca-box-backend) locally (default port `8081` in that project's `.env`).
2. Node.js + Yarn (or npm).

## Setup

```bash
yarn install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_BASE_URL` if needed:

| Environment | Typical URL |
|-------------|-------------|
| iOS simulator | `http://localhost:8081` |
| Android emulator | `http://10.0.2.2:8081` |
| Physical device | `http://<your-lan-ip>:8081` |

If unset, the app picks iOS → `localhost:8081`, Android → `10.0.2.2:8081`.

## Run

```bash
yarn start
# or
yarn ios
yarn android
```

## Auth

Sign in with a backend user (`POST /api/v1/auth/login`). The bootstrap admin is
configured on the server via `ROOT_USERNAME` / `ROOT_PASSWORD` (default username
`root`). Admin users (`role: ADMIN`) can manage users, prefixes, and create boxes.

## Architecture notes

- `store/slices/*` — domain slices with `createAsyncThunk` handlers calling `/api/v1/*`
- `store/utility/axiosInstance.ts` — shared axios client (auth header, base URL)
- `store/slices/authSlice.ts` — JWT + logged-in user (persisted via redux-persist + AsyncStorage)
- `store/useAuth.ts` — auth helpers for screens
- Local SQLite, Drizzle, and Import/Export were removed in favor of the cloud API
