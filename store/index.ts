import authReducer from "@/store/slices/authSlice";
import boxReducer from "@/store/slices/boxSlice";
import customerReducer from "@/store/slices/customerSlice";
import dashboardReducer from "@/store/slices/dashboardSlice";
import prefixReducer from "@/store/slices/prefixSlice";
import transactionReducer from "@/store/slices/transactionSlice";
import userReducer from "@/store/slices/userSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from "redux-persist";

const authPersistConfig = {
  key: "auth",
  storage: AsyncStorage,
  whitelist: ["token", "user"],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  box: boxReducer,
  customer: customerReducer,
  transaction: transactionReducer,
  user: userReducer,
  prefix: prefixReducer,
  dashboard: dashboardReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
